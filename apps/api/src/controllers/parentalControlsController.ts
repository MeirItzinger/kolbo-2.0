import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  getParentalControls,
  updateParentalControls,
} from "../services/profile/parentalControlsService";

const ratingSchema = z.enum(["G", "PG", "PG-13", "R", "NR"]);

const allowedHoursSchema = z
  .object({
    start: z.number().int().min(0).max(24),
    end: z.number().int().min(0).max(24),
  })
  .refine((h) => h.end > h.start, { message: "end must be after start" });

const updateSchema = z
  .object({
    maxMaturityRating: ratingSchema.optional(),
    blockedCategoryIds: z.array(z.string()).optional(),
    dailyTimeLimitMinutes: z
      .union([z.number().int().min(0).max(24 * 60), z.null()])
      .optional(),
    allowedHours: z.union([allowedHoursSchema, z.null()]).optional(),
    allowPurchases: z.boolean().optional(),
  })
  .strict();

export const get = asyncHandler(async (req: Request, res: Response) => {
  const controls = await getParentalControls(req.user!.id, req.params.id);
  res.json({ status: "success", data: controls });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(
      parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; "),
    );
  }
  const controls = await updateParentalControls(
    req.user!.id,
    req.params.id,
    parsed.data,
  );
  res.json({ status: "success", data: controls });
});
