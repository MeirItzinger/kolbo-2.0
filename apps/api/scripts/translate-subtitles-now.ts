/**
 * Manually translate English subs to French for specific assets.
 * Fetches VTT from Mux, translates via DeepL, uploads French track back.
 *
 * Usage:  npx tsx scripts/translate-subtitles-now.ts --category ropogos
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import Mux from "@mux/mux-node";
import { translateVtt } from "../src/services/subtitle/deeplService";

const prisma = new PrismaClient();
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

function parseCategoryArg(): string | null {
  const idx = process.argv.indexOf("--category");
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function main() {
  const categoryFilter = parseCategoryArg();

  const where: any = {
    assetStatus: "READY",
    muxAssetId: { not: null },
    muxPlaybackId: { not: null },
  };

  if (categoryFilter) {
    where.video = {
      categoryLinks: {
        some: {
          category: {
            OR: [
              { slug: { equals: categoryFilter, mode: "insensitive" } },
              { name: { equals: categoryFilter, mode: "insensitive" } },
            ],
          },
        },
      },
    };
    console.log(`Filtering to category: "${categoryFilter}"\n`);
  }

  const assets = await prisma.videoAsset.findMany({
    where,
    select: {
      id: true,
      muxAssetId: true,
      muxPlaybackId: true,
      video: { select: { title: true } },
    },
  });

  console.log(`Found ${assets.length} assets to process\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    const assetId = asset.muxAssetId!;
    const playbackId = asset.muxPlaybackId!;
    const title = asset.video?.title ?? "(untitled)";

    try {
      const muxAsset = await mux.video.assets.retrieve(assetId);

      const frenchTrack = muxAsset.tracks?.find(
        (t) => t.type === "text" && t.language_code === "fr",
      );
      if (frenchTrack) {
        console.log(`  SKIP  "${title}" — already has French subs`);
        skipped++;
        continue;
      }

      const enTrack = muxAsset.tracks?.find(
        (t) => t.type === "text" && t.language_code === "en" && t.status === "ready",
      );
      if (!enTrack) {
        console.log(`  SKIP  "${title}" — no ready English track`);
        skipped++;
        continue;
      }

      // Fetch English VTT
      const vttUrl = `https://stream.mux.com/${playbackId}/text/${enTrack.id}.vtt`;
      console.log(`  [1/3] "${title}" — fetching English VTT...`);
      const vttResp = await fetch(vttUrl);
      if (!vttResp.ok) {
        throw new Error(`Failed to fetch VTT: ${vttResp.status}`);
      }
      const englishVtt = await vttResp.text();

      // Translate via DeepL
      console.log(`  [2/3] "${title}" — translating to French (${englishVtt.length} chars)...`);
      const frenchVtt = await translateVtt(englishVtt, "fr");

      // Store in DB
      const frTrack = await prisma.subtitleTrack.upsert({
        where: {
          videoAssetId_languageCode: { videoAssetId: asset.id, languageCode: "fr" },
        },
        update: { vttContent: frenchVtt, status: "ready", source: "translated" },
        create: {
          videoAssetId: asset.id,
          languageCode: "fr",
          name: "Français",
          status: "ready",
          source: "translated",
          vttContent: frenchVtt,
        },
      });

      // Also upsert the English track record
      await prisma.subtitleTrack.upsert({
        where: {
          videoAssetId_languageCode: { videoAssetId: asset.id, languageCode: "en" },
        },
        update: { muxTrackId: enTrack.id, status: "ready" },
        create: {
          videoAssetId: asset.id,
          muxTrackId: enTrack.id,
          languageCode: "en",
          name: "English",
          status: "ready",
          source: "generated",
        },
      });

      // Upload French VTT to Mux via tunnel/public URL
      const apiBase = (process.env.TUNNEL_URL || process.env.API_PUBLIC_URL || "http://localhost:4000").replace(/\/$/, "");
      const vttServeUrl = `${apiBase}/api/subtitles/vtt/${frTrack.id}`;

      console.log(`  [3/3] "${title}" — uploading French track to Mux...`);

      // Start API server temporarily to serve VTT, or use a data approach
      // Since Mux needs to fetch the VTT from a URL, we'll write it to a temp
      // publicly accessible location. For now we use the Vercel/production URL.
      const newTrack = await mux.video.assets.createTrack(assetId, {
        url: vttServeUrl,
        type: "text",
        text_type: "subtitles",
        language_code: "fr",
        name: "Français",
        closed_captions: false,
      });

      await prisma.subtitleTrack.update({
        where: { id: frTrack.id },
        data: { muxTrackId: newTrack.id },
      });

      console.log(`  DONE  "${title}" — French track uploaded (muxTrackId: ${newTrack.id})\n`);
      success++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  "${title}" — ${msg}\n`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nResults: ${success} translated, ${skipped} skipped, ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
