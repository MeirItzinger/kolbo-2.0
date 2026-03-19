import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { mux } from "../../lib/mux";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";
import type { PlaybackPolicy, AssetStatus } from "@prisma/client";

const PLAYBACK_TOKEN_EXPIRY_SECONDS = 120;

export async function createDirectUpload(
  videoId: string,
  corsOrigin: string
): Promise<{ uploadUrl: string; uploadId: string }> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true },
  });
  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  const existingAsset = await prisma.videoAsset.findFirst({
    where: {
      videoId,
      assetStatus: { in: ["CREATED", "UPLOADED", "PROCESSING", "READY"] },
    },
  });
  if (existingAsset) {
    throw ApiError.conflict(
      "This video already has an active asset. Delete it before uploading a new one."
    );
  }

  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      video_quality: "basic",
    },
  });

  await prisma.videoAsset.create({
    data: {
      videoId,
      muxUploadId: upload.id,
      playbackPolicy: "PUBLIC",
      assetStatus: "CREATED",
    },
  });

  pollMuxUploadUntilReady(upload.id).catch((err) =>
    console.error("[mux-poll] Unhandled error in background poller:", err)
  );

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 120;

export async function pollMuxUploadUntilReady(uploadId: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const upload = await mux.video.uploads.retrieve(uploadId);
      const assetId = upload.asset_id;
      if (!assetId) continue;

      const asset = await mux.video.assets.retrieve(assetId);

      await syncAssetFromWebhook(assetId, {
        status: asset.status,
        playback_ids: asset.playback_ids?.map((p) => ({
          id: p.id!,
          policy: p.policy!,
        })),
        duration: asset.duration,
        aspect_ratio: asset.aspect_ratio,
        upload_id: uploadId,
      });

      if (asset.status === "ready") return;
    } catch (err) {
      console.error(`[mux-poll] Error polling upload ${uploadId}:`, err);
    }
  }

  console.warn(
    `[mux-poll] Gave up polling upload ${uploadId} after ${MAX_POLL_ATTEMPTS} attempts`
  );
}

export async function syncMuxAssetOnDemand(
  muxUploadId: string
): Promise<boolean> {
  try {
    const upload = await mux.video.uploads.retrieve(muxUploadId);
    const assetId = upload.asset_id;
    if (!assetId) return false;

    const asset = await mux.video.assets.retrieve(assetId);

    await syncAssetFromWebhook(assetId, {
      status: asset.status,
      playback_ids: asset.playback_ids?.map((p) => ({
        id: p.id!,
        policy: p.policy!,
      })),
      duration: asset.duration,
      aspect_ratio: asset.aspect_ratio,
      upload_id: muxUploadId,
    });

    return asset.status === "ready";
  } catch {
    return false;
  }
}

export async function syncAssetFromWebhook(
  muxAssetId: string,
  data: {
    status?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    aspect_ratio?: string;
    master_access?: string;
    upload_id?: string;
  }
): Promise<void> {
  const statusMap: Record<string, AssetStatus> = {
    preparing: "PROCESSING",
    ready: "READY",
    errored: "ERRORED",
  };

  const assetStatus = data.status
    ? statusMap[data.status] ?? "PROCESSING"
    : undefined;

  const signedPlayback = data.playback_ids?.find(
    (p) => p.policy === "signed"
  );
  const publicPlayback = data.playback_ids?.find(
    (p) => p.policy === "public"
  );
  const playbackEntry = signedPlayback ?? publicPlayback;

  const playbackPolicy: PlaybackPolicy | undefined = signedPlayback
    ? "SIGNED"
    : publicPlayback
      ? "PUBLIC"
      : undefined;

  const whereClause = data.upload_id
    ? { muxUploadId: data.upload_id }
    : { muxAssetId };

  const asset = await prisma.videoAsset.findFirst({ where: whereClause });
  if (!asset) return;

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      muxAssetId,
      ...(playbackEntry && { muxPlaybackId: playbackEntry.id }),
      ...(playbackPolicy && { playbackPolicy }),
      ...(assetStatus && { assetStatus }),
      ...(data.duration != null && {
        durationSeconds: Math.round(data.duration),
      }),
      ...(data.aspect_ratio && { aspectRatio: data.aspect_ratio }),
      ...(data.master_access && { masterAccess: data.master_access }),
    },
  });

  if (assetStatus === "READY" && data.duration != null) {
    await prisma.video.update({
      where: { id: asset.videoId },
      data: { durationSeconds: Math.round(data.duration) },
    });
  }
}

export function createSignedPlaybackToken(
  playbackId: string,
  viewerId?: string
): string {
  const privateKeyBase64 = env.MUX_SIGNING_KEY_PRIVATE;
  const keyId = env.MUX_SIGNING_KEY_ID;

  const privateKey = Buffer.from(privateKeyBase64, "base64").toString(
    "ascii"
  );

  const now = Math.floor(Date.now() / 1000);

  const payload: Record<string, unknown> = {
    sub: playbackId,
    aud: "v",
    exp: now + PLAYBACK_TOKEN_EXPIRY_SECONDS,
    kid: keyId,
  };

  if (viewerId) {
    payload.viewer_id = viewerId;
  }

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    keyid: keyId,
  });
}

export async function getPlaybackMetadata(videoAssetId: string) {
  const asset = await prisma.videoAsset.findUnique({
    where: { id: videoAssetId },
    select: {
      id: true,
      muxAssetId: true,
      muxPlaybackId: true,
      playbackPolicy: true,
      assetStatus: true,
      durationSeconds: true,
      aspectRatio: true,
    },
  });

  if (!asset) {
    throw ApiError.notFound("Video asset not found");
  }

  if (asset.assetStatus !== "READY") {
    throw ApiError.badRequest(
      `Asset is not ready for playback (status: ${asset.assetStatus})`
    );
  }

  if (!asset.muxPlaybackId) {
    throw ApiError.badRequest("No playback ID available for this asset");
  }

  return {
    playbackId: asset.muxPlaybackId,
    playbackPolicy: asset.playbackPolicy,
    durationSeconds: asset.durationSeconds,
    aspectRatio: asset.aspectRatio,
    tokenRequired: asset.playbackPolicy === "SIGNED",
  };
}

export async function deleteMuxAsset(muxAssetId: string): Promise<void> {
  try {
    await mux.video.assets.delete(muxAssetId);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
  }

  const asset = await prisma.videoAsset.findUnique({
    where: { muxAssetId },
  });

  if (asset) {
    await prisma.videoAsset.delete({ where: { id: asset.id } });
  }
}
