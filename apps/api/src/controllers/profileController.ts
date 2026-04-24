import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  createProfile,
  deleteProfile,
  getProfileForUser,
  listProfiles,
  updateProfile,
} from "../services/profile/profileService";

const NAME = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(40, "Name must be 40 characters or fewer");

const URL_OR_NULL = z.union([z.string().url("Must be a valid URL"), z.null()]);
const MATURITY = z
  .union([z.string().max(64), z.null()])
  .transform((v) => (typeof v === "string" ? v.trim() || null : v));

const createSchema = z
  .object({
    name: NAME,
    avatarUrl: URL_OR_NULL.optional(),
    maturitySettings: MATURITY.optional(),
    isKidsProfile: z.boolean().optional(),
  })
  .strict();

const updateSchema = z
  .object({
    name: NAME.optional(),
    avatarUrl: URL_OR_NULL.optional(),
    maturitySettings: MATURITY.optional(),
    isKidsProfile: z.boolean().optional(),
  })
  .strict();

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw ApiError.badRequest(
      r.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    );
  }
  return r.data;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const profiles = await listProfiles(req.user!.id);
  res.json({ status: "success", data: profiles });
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getProfileForUser(req.user!.id, req.params.id);
  res.json({ status: "success", data: profile });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = parse(createSchema, req.body);
  const profile = await createProfile(req.user!.id, body);
  res.status(201).json({ status: "success", data: profile });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = parse(updateSchema, req.body);
  const profile = await updateProfile(req.user!.id, req.params.id, body);
  res.json({ status: "success", data: profile });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await deleteProfile(req.user!.id, req.params.id);
  res.json({ status: "success", message: "Profile deleted" });
});
