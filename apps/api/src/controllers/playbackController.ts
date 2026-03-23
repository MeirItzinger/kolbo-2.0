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
import {
  findPrerollCreativeForVideo,
  chargeAdView,
} from "../services/advertiser/adPlaybackService";

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

    const userId = req.user?.id ?? null;
    const accessResult = await checkAccess(userId, videoId);

    if (!accessResult.allowed) {
      throw ApiError.forbidden(accessResult.reason);
    }

    if (userId) {
      const concurrency = await checkConcurrency(
        userId,
        accessResult.maxConcurrentStreams
      );

      if (!concurrency.allowed) {
        throw ApiError.forbidden(
          `Concurrent stream limit reached (${concurrency.activeCount}/${accessResult.maxConcurrentStreams})`
        );
      }
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
      token = createSignedPlaybackToken(asset.muxPlaybackId, userId ?? "anon");
    }

    const sourceType =
      ACCESS_TYPE_TO_SOURCE[accessResult.accessType ?? "FREE"] || "FREE";

    let sessionId: string | null = null;
    if (userId) {
      const session = await createWatchSession(
        userId,
        videoId,
        (profileId as string) || undefined,
        (deviceId as string) || undefined,
        sourceType
      );
      sessionId = session.id;
    }

    res.json({
      status: "success",
      data: {
        playbackId: asset.muxPlaybackId,
        token,
        sessionId,
        accessType: accessResult.accessType,
        adMode: accessResult.adMode,
      },
    });
  }
);

export const getPrerollAd = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoId } = req.params;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true },
    });
    if (!video) throw ApiError.notFound("Video not found");

    const creative = await findPrerollCreativeForVideo(videoId);

    if (!creative || !creative.muxPlaybackId) {
      return res.json({ status: "success", data: null });
    }

    res.json({
      status: "success",
      data: {
        creativeId: creative.id,
        playbackId: creative.muxPlaybackId,
        campaignId: creative.campaign.id,
        advertiser: creative.campaign.advertiser.companyName,
        durationSeconds: creative.durationSeconds,
      },
    });
  }
);

export const recordAdViewCharge = asyncHandler(
  async (req: Request, res: Response) => {
    const { videoId, campaignId, creativeId, idempotencyKey } = req.body as {
      videoId?: string;
      campaignId?: string;
      creativeId?: string;
      idempotencyKey?: string;
    };

    if (!videoId || !campaignId || !creativeId) {
      throw ApiError.badRequest(
        "videoId, campaignId, and creativeId are required"
      );
    }

    let result;
    try {
      result = await chargeAdView({
        videoId,
        campaignId,
        creativeId,
        idempotencyKey,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ad-view] CHARGE ERROR campaign=${campaignId} creative=${creativeId}: ${msg}`);
      throw err;
    }

    console.log(
      `[ad-view] campaign=${campaignId} creative=${creativeId} success=${result.success} amount=${result.amountUsd} status=${result.status}` +
        (result.errorMessage ? ` error=${result.errorMessage}` : "") +
        (result.duplicate ? " (duplicate)" : ""),
    );

    res.json({ status: "success", data: result });
  }
);
