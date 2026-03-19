import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import {
  checkAccess,
  checkConcurrency,
  createWatchSession,
} from "../services/access/accessService";
import { createSignedPlaybackToken } from "../services/mux/muxService";
import { prisma } from "../lib/prisma";
import type { AccessSourceType } from "@prisma/client";

const ACCESS_TYPE_TO_SOURCE: Record<string, AccessSourceType> = {
  FREE: "FREE",
  FREE_WITH_ADS: "FREE_WITH_ADS",
  SUBSCRIPTION: "SUBSCRIPTION",
  BUNDLE: "BUNDLE",
  RENTAL: "RENTAL",
  PURCHASE: "PURCHASE",
};

export const getPlaybackToken = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const { profileId, deviceId } = req.query;

    const accessResult = await checkAccess(req.user!.id, videoId);

    if (!accessResult.allowed) {
      throw ApiError.forbidden(accessResult.reason);
    }

    const concurrency = await checkConcurrency(
      req.user!.id,
      accessResult.maxConcurrentStreams
    );

    if (!concurrency.allowed) {
      throw ApiError.forbidden(
        `Concurrent stream limit reached (${concurrency.activeCount}/${accessResult.maxConcurrentStreams})`
      );
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        videoAssets: {
          where: { assetStatus: "READY" },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { muxPlaybackId: true, playbackPolicy: true },
        },
      },
    });

    if (!video || !video.videoAssets[0]?.muxPlaybackId) {
      throw ApiError.badRequest("No playable asset found");
    }

    const asset = video.videoAssets[0];
    let token: string | null = null;

    if (asset.playbackPolicy === "SIGNED") {
      token = createSignedPlaybackToken(asset.muxPlaybackId, req.user!.id);
    }

    const sourceType =
      ACCESS_TYPE_TO_SOURCE[accessResult.accessType ?? "FREE"] || "FREE";

    const session = await createWatchSession(
      req.user!.id,
      videoId,
      (profileId as string) || undefined,
      (deviceId as string) || undefined,
      sourceType
    );

    res.json({
      status: "success",
      data: {
        playbackId: asset.muxPlaybackId,
        token,
        sessionId: session.id,
        accessType: accessResult.accessType,
        adMode: accessResult.adMode,
      },
    });
  }
);
