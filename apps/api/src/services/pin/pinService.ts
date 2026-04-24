import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";

const PIN_BCRYPT_ROUNDS = 10;
const PIN_REGEX = /^\d{4}$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

const GRACE_TTL_SECONDS = 15 * 60;
const RESET_TTL_SECONDS = 60 * 60;

export type PinScope = "parental" | "profile";

export interface GraceTokenPayload {
  scope: PinScope;
  uid: string;
  pid?: string;
}

export function validatePinFormat(pin: string) {
  if (typeof pin !== "string" || !PIN_REGEX.test(pin)) {
    throw ApiError.badRequest("PIN must be exactly 4 digits");
  }
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, PIN_BCRYPT_ROUNDS);
}

async function comparePin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}

export function signGraceToken(payload: GraceTokenPayload): string {
  const options: SignOptions = { expiresIn: GRACE_TTL_SECONDS };
  return jwt.sign({ ...payload, kind: "pin-grace" }, env.JWT_ACCESS_SECRET, options);
}

export function verifyGraceToken(
  token: string,
  expected: { scope: PinScope; uid: string; pid?: string },
): boolean {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Record<
      string,
      any
    >;
    if (decoded?.kind !== "pin-grace") return false;
    if (decoded.scope !== expected.scope) return false;
    if (decoded.uid !== expected.uid) return false;
    if (expected.pid && decoded.pid !== expected.pid) return false;
    return true;
  } catch {
    return false;
  }
}

async function assertNotLocked(
  userId: string,
  scope: PinScope,
  profileId?: string,
) {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000);
  const recentFailures = await prisma.pinAttemptLog.count({
    where: {
      userId,
      pinType: scope,
      profileId: scope === "profile" ? profileId ?? null : null,
      success: false,
      createdAt: { gte: since },
    },
  });
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    throw ApiError.tooMany(
      `Too many incorrect attempts. Try again in ${LOCKOUT_WINDOW_MINUTES} minutes.`,
    );
  }
}

async function logAttempt(args: {
  userId: string;
  scope: PinScope;
  profileId?: string;
  success: boolean;
  ip?: string;
}) {
  await prisma.pinAttemptLog.create({
    data: {
      userId: args.userId,
      pinType: args.scope,
      profileId: args.scope === "profile" ? args.profileId ?? null : null,
      success: args.success,
      ipAddress: args.ip ?? null,
    },
  });
}

// ─── Parental PIN (account-level) ─────────────────────────────────────────

export async function setParentalPin(
  userId: string,
  pin: string,
  currentPin?: string,
) {
  validatePinFormat(pin);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentalPinHash: true },
  });
  if (!user) throw ApiError.notFound("User not found");

  if (user.parentalPinHash) {
    if (!currentPin) {
      throw ApiError.badRequest("Current PIN is required to change the PIN");
    }
    const ok = await comparePin(currentPin, user.parentalPinHash);
    if (!ok) throw ApiError.unauthorized("Current PIN is incorrect");
  }

  const hash = await hashPin(pin);
  await prisma.user.update({
    where: { id: userId },
    data: { parentalPinHash: hash, parentalPinSetAt: new Date() },
  });
}

export async function clearParentalPin(userId: string, currentPin: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentalPinHash: true },
  });
  if (!user?.parentalPinHash) {
    return; // no-op
  }
  const ok = await comparePin(currentPin, user.parentalPinHash);
  if (!ok) throw ApiError.unauthorized("Current PIN is incorrect");
  await prisma.user.update({
    where: { id: userId },
    data: { parentalPinHash: null, parentalPinSetAt: null },
  });
}

export async function verifyParentalPin(
  userId: string,
  pin: string,
  ip?: string,
): Promise<{ graceToken: string }> {
  validatePinFormat(pin);
  await assertNotLocked(userId, "parental");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentalPinHash: true },
  });
  if (!user?.parentalPinHash) {
    throw ApiError.badRequest("No parental PIN is set");
  }
  const ok = await comparePin(pin, user.parentalPinHash);
  await logAttempt({ userId, scope: "parental", success: ok, ip });
  if (!ok) throw ApiError.unauthorized("Incorrect PIN");
  return {
    graceToken: signGraceToken({ scope: "parental", uid: userId }),
  };
}

export function signPinResetToken(userId: string): string {
  return jwt.sign(
    { uid: userId, kind: "pin-reset" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: RESET_TTL_SECONDS },
  );
}

export function verifyPinResetToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as Record<
      string,
      any
    >;
    if (decoded?.kind !== "pin-reset") return null;
    return typeof decoded.uid === "string" ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function resetParentalPinWithToken(
  token: string,
  newPin: string,
) {
  validatePinFormat(newPin);
  const userId = verifyPinResetToken(token);
  if (!userId) {
    throw ApiError.badRequest("Reset link is invalid or has expired");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw ApiError.notFound("User not found");
  const hash = await hashPin(newPin);
  await prisma.user.update({
    where: { id: userId },
    data: { parentalPinHash: hash, parentalPinSetAt: new Date() },
  });
}

export async function isParentalPinSet(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { parentalPinHash: true },
  });
  return !!user?.parentalPinHash;
}

// ─── Profile PIN ──────────────────────────────────────────────────────────

async function loadProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, pinHash: true },
  });
  if (!profile) throw ApiError.notFound("Profile not found");
  return profile;
}

export async function setProfilePin(
  userId: string,
  profileId: string,
  pin: string,
  currentPin?: string,
) {
  validatePinFormat(pin);
  const profile = await loadProfile(userId, profileId);
  if (profile.pinHash) {
    if (!currentPin) {
      throw ApiError.badRequest("Current PIN is required to change the PIN");
    }
    const ok = await comparePin(currentPin, profile.pinHash);
    if (!ok) throw ApiError.unauthorized("Current PIN is incorrect");
  }
  const hash = await hashPin(pin);
  await prisma.profile.update({
    where: { id: profileId },
    data: { pinHash: hash, pinSetAt: new Date() },
  });
}

export async function clearProfilePin(
  userId: string,
  profileId: string,
  currentPin: string,
) {
  const profile = await loadProfile(userId, profileId);
  if (!profile.pinHash) return;
  const ok = await comparePin(currentPin, profile.pinHash);
  if (!ok) throw ApiError.unauthorized("Current PIN is incorrect");
  await prisma.profile.update({
    where: { id: profileId },
    data: { pinHash: null, pinSetAt: null },
  });
}

export async function verifyProfilePin(
  userId: string,
  profileId: string,
  pin: string,
  ip?: string,
): Promise<{ graceToken: string }> {
  validatePinFormat(pin);
  await assertNotLocked(userId, "profile", profileId);
  const profile = await loadProfile(userId, profileId);
  if (!profile.pinHash) {
    throw ApiError.badRequest("No PIN is set for this profile");
  }
  const ok = await comparePin(pin, profile.pinHash);
  await logAttempt({ userId, scope: "profile", profileId, success: ok, ip });
  if (!ok) throw ApiError.unauthorized("Incorrect PIN");
  return {
    graceToken: signGraceToken({
      scope: "profile",
      uid: userId,
      pid: profileId,
    }),
  };
}

export async function isProfilePinSet(
  userId: string,
  profileId: string,
): Promise<boolean> {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { pinHash: true },
  });
  return !!profile?.pinHash;
}
