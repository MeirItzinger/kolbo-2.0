import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { prisma } from "../lib/prisma";
import { sendPinResetEmail } from "../lib/email";
import {
  clearParentalPin,
  clearProfilePin,
  isParentalPinSet,
  isProfilePinSet,
  resetParentalPinWithToken,
  setParentalPin,
  setProfilePin,
  signPinResetToken,
  verifyGraceToken,
  verifyParentalPin,
  verifyProfilePin,
  type PinScope,
} from "../services/pin/pinService";

const PIN = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");

const setSchema = z.object({ pin: PIN, currentPin: PIN.optional() }).strict();
const verifySchema = z.object({ pin: PIN }).strict();
const clearSchema = z.object({ currentPin: PIN }).strict();

function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw ApiError.badRequest(
      r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    );
  }
  return r.data;
}

function clientIp(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0];
  return req.ip ?? undefined;
}

// ── Parental PIN (account-level) ──────────────────────────────────────────

export const getParentalStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const set = await isParentalPinSet(req.user!.id);
    res.json({ status: "success", data: { isSet: set } });
  },
);

export const setParental = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(setSchema, req.body);
    await setParentalPin(req.user!.id, body.pin, body.currentPin);
    res.json({ status: "success", message: "Parental PIN updated" });
  },
);

export const verifyParental = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(verifySchema, req.body);
    const result = await verifyParentalPin(
      req.user!.id,
      body.pin,
      clientIp(req),
    );
    res.json({ status: "success", data: result });
  },
);

export const clearParental = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(clearSchema, req.body);
    await clearParentalPin(req.user!.id, body.currentPin);
    res.json({ status: "success", message: "Parental PIN removed" });
  },
);

export const requestParentalReset = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, parentalPinHash: true },
    });
    if (user?.email && user.parentalPinHash) {
      const token = signPinResetToken(userId);
      try {
        await sendPinResetEmail(user.email, token);
      } catch (err) {
        console.error("[pin reset email]", err);
      }
    }
    res.json({
      status: "success",
      message: "If a PIN is set on this account, a reset email has been sent.",
    });
  },
);

const resetConfirmSchema = z
  .object({ token: z.string().min(10), pin: PIN })
  .strict();

export const confirmParentalReset = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(resetConfirmSchema, req.body);
    await resetParentalPinWithToken(body.token, body.pin);
    res.json({ status: "success", message: "Parental PIN updated" });
  },
);

// ── Profile PIN ───────────────────────────────────────────────────────────

export const getProfileStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const set = await isProfilePinSet(req.user!.id, req.params.id);
    res.json({ status: "success", data: { isSet: set } });
  },
);

export const setProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(setSchema, req.body);
    await setProfilePin(
      req.user!.id,
      req.params.id,
      body.pin,
      body.currentPin,
    );
    res.json({ status: "success", message: "Profile PIN updated" });
  },
);

export const verifyProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(verifySchema, req.body);
    const result = await verifyProfilePin(
      req.user!.id,
      req.params.id,
      body.pin,
      clientIp(req),
    );
    res.json({ status: "success", data: result });
  },
);

export const clearProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parse(clearSchema, req.body);
    await clearProfilePin(req.user!.id, req.params.id, body.currentPin);
    res.json({ status: "success", message: "Profile PIN removed" });
  },
);

/**
 * Express middleware factory: requires a valid PIN grace token in
 * `X-Pin-Grace` header. Used to gate sensitive endpoints (parental controls
 * editor, purchase intents) once PIN protection is enabled.
 */
export function requirePinGrace(scope: PinScope) {
  return asyncHandler(async (req: Request, _res: Response, next) => {
    const userId = req.user!.id;
    const profileId = scope === "profile" ? req.params.id : undefined;

    if (scope === "parental") {
      const isSet = await isParentalPinSet(userId);
      if (!isSet) return next(); // no PIN → not gated
    } else {
      const isSet = await isProfilePinSet(userId, profileId!);
      if (!isSet) return next();
    }

    const header = req.headers["x-pin-grace"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || typeof token !== "string") {
      throw new ApiError(428, "PIN required");
    }
    const ok = verifyGraceToken(token, { scope, uid: userId, pid: profileId });
    if (!ok) throw new ApiError(428, "PIN required");
    next();
  });
}

/**
 * Gates checkout/purchase endpoints when the household has opted into
 * "Require PIN for purchases" AND a parental PIN is set. Otherwise transparent.
 */
export const requirePurchasePin = asyncHandler(
  async (req: Request, _res: Response, next) => {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { requirePinForPurchases: true, parentalPinHash: true },
    });
    if (!user?.requirePinForPurchases || !user.parentalPinHash) {
      return next();
    }
    const header = req.headers["x-pin-grace"];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || typeof token !== "string") {
      throw new ApiError(428, "PIN required for purchases");
    }
    const ok = verifyGraceToken(token, { scope: "parental", uid: userId });
    if (!ok) throw new ApiError(428, "PIN required for purchases");
    next();
  },
);
