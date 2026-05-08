import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

export type MaturityRating = "G" | "PG" | "PG-13" | "R" | "NR";

export interface ParentalControls {
  /** Highest maturity rating this profile may watch. */
  maxMaturityRating: MaturityRating;
  /** Channel/category IDs this profile is not allowed to watch. */
  blockedCategoryIds: string[];
  /** Daily watch-time cap, in minutes. null = unlimited. */
  dailyTimeLimitMinutes: number | null;
  /** Allowed window during the day (24h clock). null = always. */
  allowedHours: { start: number; end: number } | null;
  /** Whether this profile may purchase or rent on its own. */
  allowPurchases: boolean;
}

export const DEFAULT_CONTROLS: ParentalControls = {
  maxMaturityRating: "NR",
  blockedCategoryIds: [],
  dailyTimeLimitMinutes: null,
  allowedHours: null,
  allowPurchases: true,
};

const KIDS_DEFAULTS: ParentalControls = {
  maxMaturityRating: "PG",
  blockedCategoryIds: [],
  dailyTimeLimitMinutes: 90,
  allowedHours: { start: 7, end: 20 },
  allowPurchases: false,
};

function defaultsFor(isKidsProfile: boolean): ParentalControls {
  return isKidsProfile ? KIDS_DEFAULTS : DEFAULT_CONTROLS;
}

function normalize(
  raw: unknown,
  isKidsProfile: boolean,
): ParentalControls {
  const base = defaultsFor(isKidsProfile);
  if (!raw || typeof raw !== "object") return base;
  const partial = raw as Partial<ParentalControls>;
  return {
    maxMaturityRating: partial.maxMaturityRating ?? base.maxMaturityRating,
    blockedCategoryIds: Array.isArray(partial.blockedCategoryIds)
      ? partial.blockedCategoryIds.filter((s): s is string => typeof s === "string")
      : base.blockedCategoryIds,
    dailyTimeLimitMinutes:
      typeof partial.dailyTimeLimitMinutes === "number"
        ? partial.dailyTimeLimitMinutes
        : partial.dailyTimeLimitMinutes === null
        ? null
        : base.dailyTimeLimitMinutes,
    allowedHours:
      partial.allowedHours && typeof partial.allowedHours === "object"
        ? {
            start: Number(partial.allowedHours.start) || 0,
            end: Number(partial.allowedHours.end) || 24,
          }
        : partial.allowedHours === null
        ? null
        : base.allowedHours,
    allowPurchases:
      typeof partial.allowPurchases === "boolean"
        ? partial.allowPurchases
        : base.allowPurchases,
  };
}

async function loadProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: {
      id: true,
      isKidsProfile: true,
      parentalControls: true,
    },
  });
  if (!profile) throw ApiError.notFound("Profile not found");
  return profile;
}

export async function getParentalControls(
  userId: string,
  profileId: string,
): Promise<ParentalControls> {
  const profile = await loadProfile(userId, profileId);
  return normalize(profile.parentalControls, profile.isKidsProfile);
}

export async function updateParentalControls(
  userId: string,
  profileId: string,
  patch: Partial<ParentalControls>,
): Promise<ParentalControls> {
  const profile = await loadProfile(userId, profileId);
  const current = normalize(profile.parentalControls, profile.isKidsProfile);
  const next: ParentalControls = {
    maxMaturityRating: patch.maxMaturityRating ?? current.maxMaturityRating,
    blockedCategoryIds:
      patch.blockedCategoryIds ?? current.blockedCategoryIds,
    dailyTimeLimitMinutes:
      patch.dailyTimeLimitMinutes !== undefined
        ? patch.dailyTimeLimitMinutes
        : current.dailyTimeLimitMinutes,
    allowedHours:
      patch.allowedHours !== undefined ? patch.allowedHours : current.allowedHours,
    allowPurchases: patch.allowPurchases ?? current.allowPurchases,
  };

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      parentalControls: next as unknown as Prisma.InputJsonValue,
    },
  });

  return next;
}

export function maturityRank(rating: MaturityRating): number {
  switch (rating) {
    case "G":
      return 0;
    case "PG":
      return 1;
    case "PG-13":
      return 2;
    case "R":
      return 3;
    case "NR":
    default:
      return 99;
  }
}

function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
}

function isOutsideAllowedHours(
  range: { start: number; end: number } | null,
  now: Date = new Date(),
): boolean {
  if (!range) return false;
  const { start, end } = range;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMin = start * 60;
  const endMin = end * 60;
  if (startMin === endMin) return false; // 24h allow
  if (startMin < endMin) {
    return minutesNow < startMin || minutesNow >= endMin;
  }
  // Overnight window, e.g. 20:00 → 06:00
  return minutesNow >= endMin && minutesNow < startMin;
}

/**
 * Sums "watched seconds today" for a profile. We use `playbackSeconds` when
 * present (heartbeat keeps it fresh) and otherwise fall back to wall-clock
 * since `startedAt`, capped by `endedAt`/`lastHeartbeatAt`. `excludeSessionId`
 * lets the caller add the live elapsed time for the session being processed
 * separately so the same seconds aren't counted twice.
 */
export async function sumWatchedSecondsToday(
  profileId: string,
  excludeSessionId?: string,
): Promise<number> {
  const sessions = await prisma.watchSession.findMany({
    where: {
      profileId,
      startedAt: { gte: startOfTodayUtc() },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    select: {
      startedAt: true,
      endedAt: true,
      lastHeartbeatAt: true,
      playbackSeconds: true,
    },
  });

  let total = 0;
  for (const s of sessions) {
    if (typeof s.playbackSeconds === "number" && s.playbackSeconds > 0) {
      total += s.playbackSeconds;
      continue;
    }
    const end = s.endedAt ?? s.lastHeartbeatAt;
    const elapsed = Math.max(0, Math.floor((end.getTime() - s.startedAt.getTime()) / 1000));
    total += elapsed;
  }
  return total;
}

export type ParentalBlockReason =
  | "OUTSIDE_HOURS"
  | "MATURITY"
  | "TIME_LIMIT"
  | "PURCHASES";

export interface ParentalBlockedError extends Error {
  statusCode: 403;
  code: "PARENTAL_BLOCKED";
  reason: ParentalBlockReason;
  details: {
    maxMaturityRating?: MaturityRating;
    videoMaturityRating?: string | null;
    allowedHours?: { start: number; end: number };
    dailyTimeLimitMinutes?: number;
    secondsUsed?: number;
    profileName?: string;
  };
}

function blocked(
  reason: ParentalBlockReason,
  message: string,
  details: ParentalBlockedError["details"],
): ParentalBlockedError {
  const err = new Error(message) as ParentalBlockedError;
  err.statusCode = 403;
  err.code = "PARENTAL_BLOCKED";
  err.reason = reason;
  err.details = details;
  return err;
}

export function isParentalBlockedError(
  err: unknown,
): err is ParentalBlockedError {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "PARENTAL_BLOCKED";
}

interface AssertParentalAccessInput {
  userId: string;
  profileId: string | null | undefined;
  video: { id: string; maturityRating: string | null };
  /** Live elapsed seconds for the in-flight session, added to today's total. */
  liveSessionSeconds?: number;
  /** When provided, that session is excluded from the historic sum. */
  liveSessionId?: string;
}

/**
 * Throws `ParentalBlockedError` (HTTP 403) when the active profile's parental
 * controls disallow continued playback. No-ops when no profile is selected
 * (anonymous / parent profile).
 */
export async function assertParentalAccess(
  input: AssertParentalAccessInput,
): Promise<void> {
  const { userId, profileId, video, liveSessionSeconds = 0, liveSessionId } = input;
  if (!profileId) return;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, isKidsProfile: true, parentalControls: true },
  });
  if (!profile) return; // ID doesn't belong to this user; let other code handle it

  const controls = normalize(profile.parentalControls, profile.isKidsProfile);

  if (isOutsideAllowedHours(controls.allowedHours)) {
    throw blocked(
      "OUTSIDE_HOURS",
      "This profile is outside its allowed watch window.",
      { allowedHours: controls.allowedHours ?? undefined },
    );
  }

  const cap = maturityRank(controls.maxMaturityRating);
  const videoRank = maturityRank((video.maturityRating as MaturityRating) ?? "NR");
  // NR videos require an NR cap; everything else must be <= cap.
  const exceedsCap =
    videoRank === maturityRank("NR")
      ? cap !== maturityRank("NR")
      : videoRank > cap;
  if (exceedsCap) {
    throw blocked(
      "MATURITY",
      "This title exceeds the profile's maturity cap.",
      {
        maxMaturityRating: controls.maxMaturityRating,
        videoMaturityRating: video.maturityRating,
      },
    );
  }

  const limitMinutes = controls.dailyTimeLimitMinutes;
  if (limitMinutes !== null && limitMinutes !== undefined && limitMinutes > 0) {
    const limitSeconds = Math.round(limitMinutes * 60);
    const historic = await sumWatchedSecondsToday(profileId, liveSessionId);
    const total = historic + Math.max(0, liveSessionSeconds);
    if (total >= limitSeconds) {
      throw blocked(
        "TIME_LIMIT",
        "Daily watch-time limit reached for this profile.",
        {
          dailyTimeLimitMinutes: limitMinutes,
          secondsUsed: total,
        },
      );
    }
  }
}

/**
 * Throws `ParentalBlockedError` (HTTP 403, reason "PURCHASES") when the active
 * profile's parental controls disallow making purchases. Used to gate Stripe
 * checkout endpoints. No-ops when no profile id is supplied (e.g. signup flow
 * before any profile exists yet).
 */
export async function assertProfileCanPurchase(
  userId: string,
  profileId: string | null | undefined,
): Promise<void> {
  if (!profileId) return;

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, name: true, isKidsProfile: true, parentalControls: true },
  });
  if (!profile) return;

  const controls = normalize(profile.parentalControls, profile.isKidsProfile);
  if (!controls.allowPurchases) {
    throw blocked(
      "PURCHASES",
      `Purchases are disabled for the ${profile.name} profile.`,
      { profileName: profile.name },
    );
  }
}
