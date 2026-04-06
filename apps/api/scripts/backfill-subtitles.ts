/**
 * One-time script to add auto-generated English subtitles to existing
 * Mux assets. Once each English track is ready, the webhook pipeline will
 * automatically trigger French translation via DeepL.
 *
 * Usage:
 *   npx tsx scripts/backfill-subtitles.ts                   # all videos
 *   npx tsx scripts/backfill-subtitles.ts --category ropogos # specific category
 */

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import Mux from "@mux/mux-node";

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
      video: { select: { title: true } },
    },
  });

  console.log(`Found ${assets.length} ready assets to backfill\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of assets) {
    const assetId = asset.muxAssetId!;
    const title = asset.video?.title ?? "(untitled)";

    try {
      const muxAsset = await mux.video.assets.retrieve(assetId);
      const hasEnglishSubs = muxAsset.tracks?.some(
        (t) => t.type === "text" && t.language_code === "en",
      );

      if (hasEnglishSubs) {
        console.log(`  SKIP  "${title}" (${assetId}) — already has English subs`);
        skipped++;
        continue;
      }

      const audioTrack = muxAsset.tracks?.find((t) => t.type === "audio");
      if (!audioTrack?.id) {
        console.log(`  SKIP  "${title}" (${assetId}) — no audio track found`);
        skipped++;
        continue;
      }

      await (mux.video.assets as any).generateSubtitles(assetId, audioTrack.id, {
        generated_subtitles: [
          { language_code: "en", name: "English" },
        ],
      });

      console.log(`  OK    "${title}" (${assetId}) — English subs requested via audio track ${audioTrack.id}`);
      success++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  "${title}" (${assetId}) — ${msg}`);
      failed++;
    }

    // Small delay to avoid Mux rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${success} requested, ${skipped} skipped, ${failed} failed`);
  console.log("French translations will be triggered automatically via webhooks when English tracks are ready.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
