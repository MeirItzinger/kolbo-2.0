import { prisma } from "../../lib/prisma";
import { syncAssetFromWebhook } from "./muxService";
import { handleTrackReady } from "../subtitle/subtitleService";
import type { AssetStatus } from "@prisma/client";

interface MuxWebhookEvent {
  type: string;
  data: Record<string, unknown>;
  object: {
    type: string;
    id: string;
  };
}

export async function handleWebhookEvent(
  event: MuxWebhookEvent
): Promise<void> {
  switch (event.type) {
    case "video.asset.created":
      await handleAssetCreated(event);
      break;
    case "video.asset.ready":
      await handleAssetReady(event);
      break;
    case "video.asset.errored":
      await handleAssetErrored(event);
      break;
    case "video.upload.asset_created":
      await handleUploadAssetCreated(event);
      break;
    case "video.asset.track.ready":
      await handleAssetTrackReady(event);
      break;
    default:
      break;
  }
}

async function handleAssetCreated(event: MuxWebhookEvent): Promise<void> {
  const data = event.data as {
    id: string;
    status: string;
    upload_id?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    aspect_ratio?: string;
  };

  await syncAssetFromWebhook(data.id, {
    status: data.status,
    playback_ids: data.playback_ids,
    duration: data.duration,
    aspect_ratio: data.aspect_ratio,
    upload_id: data.upload_id,
  });
}

async function handleAssetReady(event: MuxWebhookEvent): Promise<void> {
  const data = event.data as {
    id: string;
    status: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    duration?: number;
    aspect_ratio?: string;
    master_access?: string;
  };

  await syncAssetFromWebhook(data.id, {
    status: "ready",
    playback_ids: data.playback_ids,
    duration: data.duration,
    aspect_ratio: data.aspect_ratio,
    master_access: data.master_access,
  });

  const asset = await prisma.videoAsset.findUnique({
    where: { muxAssetId: data.id },
    select: { videoId: true },
  });

  if (asset) {
    const video = await prisma.video.findUnique({
      where: { id: asset.videoId },
      select: { status: true },
    });

    if (video && video.status === "PROCESSING") {
      await prisma.video.update({
        where: { id: asset.videoId },
        data: { status: "DRAFT" },
      });
    }
  }
}

async function handleAssetErrored(event: MuxWebhookEvent): Promise<void> {
  const data = event.data as {
    id: string;
    errors?: { type: string; messages: string[] };
  };

  const asset = await prisma.videoAsset.findUnique({
    where: { muxAssetId: data.id },
  });

  if (!asset) return;

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: { assetStatus: "ERRORED" },
  });
}

async function handleUploadAssetCreated(
  event: MuxWebhookEvent
): Promise<void> {
  const data = event.data as {
    id: string;
    new_asset_id?: string;
    asset_id?: string;
  };

  const muxAssetId = data.new_asset_id ?? data.asset_id;
  if (!muxAssetId) return;

  const uploadId = data.id;

  const asset = await prisma.videoAsset.findFirst({
    where: { muxUploadId: uploadId },
  });

  if (!asset) return;

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      muxAssetId,
      assetStatus: "UPLOADED",
    },
  });
}

async function handleAssetTrackReady(event: MuxWebhookEvent): Promise<void> {
  const data = event.data as {
    asset_id?: string;
    id: string;
    type: string;
    text_type?: string;
    language_code?: string;
    name?: string;
    status?: string;
  };

  const assetId = data.asset_id ?? event.object?.id;
  if (!assetId) {
    console.warn("[mux-webhook] track.ready event missing asset_id");
    return;
  }

  await handleTrackReady(assetId, {
    id: data.id,
    type: data.type,
    text_type: data.text_type,
    language_code: data.language_code,
    name: data.name,
    status: data.status,
  });
}
