import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  getAccountSettings,
  updateAccountSettings,
} from "../services/account/settingsService";

const updateSchema = z
  .object({
    requirePinForPurchases: z.boolean().optional(),
  })
  .strict();

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const settings = await getAccountSettings(userId);
  res.json({ status: "success", data: settings });
});

export const updateSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw ApiError.badRequest(
        parsed.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ")
      );
    }
    const settings = await updateAccountSettings(userId, parsed.data);
    res.json({ status: "success", data: settings });
  }
);
