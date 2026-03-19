import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  heartbeat as heartbeatService,
  endSession as endSessionService,
} from "../services/access/accessService";

export const heartbeat = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) throw ApiError.badRequest("sessionId is required");

  await heartbeatService(sessionId);

  res.json({ status: "success", message: "Heartbeat recorded" });
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) throw ApiError.badRequest("sessionId is required");

  await endSessionService(sessionId);

  res.json({ status: "success", message: "Session ended" });
});
