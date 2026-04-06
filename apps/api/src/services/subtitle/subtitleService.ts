import { prisma } from "../../lib/prisma";
import { mux } from "../../lib/mux";
import { env } from "../../config/env";
import { translateVtt } from "./deeplService";

export async function handleTrackReady(
  muxAssetId: string,
  trackData: {
    id: string;
    type: string;
    text_type?: string;
    language_code?: string;
    name?: string;
    status?: string;
  },
): Promise<void> {
  const asset = await prisma.videoAsset.findUnique({
    where: { muxAssetId },
    select: { id: true, muxPlaybackId: true },
  });

  if (!asset) {
    console.warn(`[subtitles] No VideoAsset found for muxAssetId=${muxAssetId}`);
    return;
  }

  if (trackData.type !== "text" || trackData.text_type !== "subtitles") {
    return;
  }

  const langCode = trackData.language_code ?? "unknown";
  const trackName = trackData.name ?? langCode.toUpperCase();

  await prisma.subtitleTrack.upsert({
    where: { videoAssetId_languageCode: { videoAssetId: asset.id, languageCode: langCode } },
    update: {
      muxTrackId: trackData.id,
      status: "ready",
    },
    create: {
      videoAssetId: asset.id,
      muxTrackId: trackData.id,
      languageCode: langCode,
      name: trackName,
      status: "ready",
      source: langCode === "en" ? "generated" : "translated",
    },
  });

  console.log(`[subtitles] Track ready: asset=${muxAssetId} lang=${langCode} trackId=${trackData.id}`);

  if (langCode === "en" && env.DEEPL_API_KEY) {
    triggerFrenchTranslation(muxAssetId, asset.id, asset.muxPlaybackId, trackData.id).catch(
      (err) => console.error("[subtitles] French translation failed:", err),
    );
  }
}

async function triggerFrenchTranslation(
  muxAssetId: string,
  videoAssetId: string,
  muxPlaybackId: string | null,
  englishTrackId: string,
): Promise<void> {
  const existing = await prisma.subtitleTrack.findUnique({
    where: { videoAssetId_languageCode: { videoAssetId, languageCode: "fr" } },
  });
  if (existing && existing.status === "ready") {
    console.log("[subtitles] French track already exists, skipping translation");
    return;
  }

  await prisma.subtitleTrack.upsert({
    where: { videoAssetId_languageCode: { videoAssetId, languageCode: "fr" } },
    update: { status: "translating" },
    create: {
      videoAssetId,
      languageCode: "fr",
      name: "Français",
      status: "translating",
      source: "translated",
    },
  });

  if (!muxPlaybackId) {
    console.error("[subtitles] No playbackId to fetch VTT from");
    await prisma.subtitleTrack.update({
      where: { videoAssetId_languageCode: { videoAssetId, languageCode: "fr" } },
      data: { status: "errored" },
    });
    return;
  }

  const vttUrl = `https://stream.mux.com/${muxPlaybackId}/text/${englishTrackId}.vtt`;
  console.log(`[subtitles] Fetching English VTT from ${vttUrl}`);

  const vttResponse = await fetch(vttUrl);
  if (!vttResponse.ok) {
    console.error(`[subtitles] Failed to fetch VTT: ${vttResponse.status}`);
    await prisma.subtitleTrack.update({
      where: { videoAssetId_languageCode: { videoAssetId, languageCode: "fr" } },
      data: { status: "errored" },
    });
    return;
  }

  const englishVtt = await vttResponse.text();
  console.log(`[subtitles] Translating ${englishVtt.length} chars to French via DeepL`);

  const frenchVtt = await translateVtt(englishVtt, "fr");

  const frTrack = await prisma.subtitleTrack.update({
    where: { videoAssetId_languageCode: { videoAssetId, languageCode: "fr" } },
    data: { vttContent: frenchVtt, status: "uploading" },
  });

  const apiBase = env.CLIENT_URL.replace(/\/$/, "");
  const vttServeUrl = `${apiBase}/api/subtitles/vtt/${frTrack.id}`;

  console.log(`[subtitles] Uploading French track to Mux, VTT URL: ${vttServeUrl}`);

  const newTrack = await mux.video.assets.createTrack(muxAssetId, {
    url: vttServeUrl,
    type: "text",
    text_type: "subtitles",
    language_code: "fr",
    name: "Français",
    closed_captions: false,
  });

  await prisma.subtitleTrack.update({
    where: { id: frTrack.id },
    data: { muxTrackId: newTrack.id, status: "ready" },
  });

  console.log(`[subtitles] French track uploaded: muxTrackId=${newTrack.id}`);
}
