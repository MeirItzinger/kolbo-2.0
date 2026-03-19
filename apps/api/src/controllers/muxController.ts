import crypto from "crypto";
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { env } from "../config/env";
import { createDirectUpload } from "../services/mux/muxService";
import { handleWebhookEvent } from "../services/mux/muxWebhookService";

export const createUpload = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoId, corsOrigin } = req.body;

    if (!videoId) throw ApiError.badRequest("videoId is required");

    const origin = corsOrigin || env.CLIENT_URL;
    const result = await createDirectUpload(videoId, origin);

    res.status(201).json({ status: "success", data: result });
  }
);

export const handleWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers["mux-signature"] as string | undefined;

    if (env.MUX_WEBHOOK_SECRET && signature) {
      const payload =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const expectedSig = crypto
        .createHmac("sha256", env.MUX_WEBHOOK_SECRET)
        .update(payload)
        .digest("hex");

      const parts = signature.split(",");
      const sigValues = parts
        .map((p) => p.split("="))
        .filter(([k]) => k === "v1")
        .map(([, v]) => v);

      const valid = sigValues.some(
        (v) => crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expectedSig))
      );

      if (!valid) {
        throw ApiError.badRequest("Invalid Mux webhook signature");
      }
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await handleWebhookEvent(event);

    res.json({ received: true });
  }
);
