import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  heartbeat as heartbeatService,
  endSession as endSessionService,
} from "../services/access/accessService";
import {
  assertParentalAccess,
  isParentalBlockedError,
} from "../services/profile/parentalControlsService";
import { prisma } from "../lib/prisma";

export const heartbeat = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) throw ApiError.badRequest("sessionId is required");

  const result = await heartbeatService(sessionId);

  if (result.profileId && result.userId === req.user?.id) {
    const video = await prisma.video.findUnique({
      where: { id: result.videoId },
      select: { id: true, maturityRating: true },
    });

    if (video) {
      try {
        await assertParentalAccess({
          userId: result.userId,
          profileId: result.profileId,
          video,
          liveSessionId: result.sessionId,
          liveSessionSeconds: result.playbackSeconds,
        });
      } catch (err) {
        if (isParentalBlockedError(err)) {
          // End the session so concurrency counts free up immediately, then
          // tell the client to stop playback.
          await endSessionService(result.sessionId).catch(() => {});
          return res.status(403).json({
            status: "error",
            code: err.code,
            reason: err.reason,
            message: err.message,
            details: err.details,
          });
        }
        throw err;
      }
    }
  }

  res.json({
    status: "success",
    message: "Heartbeat recorded",
    data: { playbackSeconds: result.playbackSeconds },
  });
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) throw ApiError.badRequest("sessionId is required");

  await endSessionService(sessionId);

  res.json({ status: "success", message: "Session ended" });
});
