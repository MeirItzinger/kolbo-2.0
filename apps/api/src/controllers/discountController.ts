import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validateDiscountCode } from "../services/stripe/stripeService";

export const validate = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body;
  const result = await validateDiscountCode(code);
  res.json({ status: "success", data: result });
});
