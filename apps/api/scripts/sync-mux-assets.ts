/**
 * Matches videos in the DB to Mux assets by title, then backfills
 * muxAssetId and muxPlaybackId into the VideoAsset table.
 *
 * Workflow:
 *
 *   1. Dry-run to preview:
 *        npx ts-node scripts/sync-mux-assets.ts --dry-run
 *
 *   2. If there are [AMBIGUOUS] entries, export them:
 *        npx ts-node scripts/sync-mux-assets.ts --export-ambiguous ambiguous.json
 *      Edit ambiguous.json — set "chosenMuxAssetId" for each entry to the correct asset ID.
 *
 *   3. Apply, passing the resolved file:
 *        npx ts-node scripts/sync-mux-assets.ts --resolve ambiguous.json
 *      (ambiguous entries without a chosenMuxAssetId are still skipped)
 *
 *   4. Or just apply without resolving ambiguous ones:
 *        npx ts-node scripts/sync-mux-assets.ts
 */
import Mux from "@mux/mux-node";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

const DRY_RUN = process.argv.includes("--dry-run");

const exportFlagIdx = process.argv.indexOf("--export-ambiguous");
const EXPORT_FILE = exportFlagIdx !== -1 ? process.argv[exportFlagIdx + 1] : null;

const resolveFlagIdx = process.argv.indexOf("--resolve");
const RESOLVE_FILE = resolveFlagIdx !== -1 ? process.argv[resolveFlagIdx + 1] : null;

type MuxAsset = {
  id: string;
  meta?: { title?: string; external_id?: string };
  status: string;
  playback_ids?: Array<{ id: string; policy: string }>;
  duration?: number;
  aspect_ratio?: string;
  created_at?: string; // Unix timestamp string
};

/** Pick the best asset from duplicates: prefer ready, then most recently created. */
function pickBest(candidates: MuxAsset[]): MuxAsset {
  const ready = candidates.filter((c) => c.status === "ready");
  const pool = ready.length > 0 ? ready : candidates;
  return pool.reduce((best, c) => {
    const bestTs = parseInt(best.created_at ?? "0", 10);
    const cTs = parseInt(c.created_at ?? "0", 10);
    return cTs > bestTs ? c : best;
  });
}

type AmbiguousEntry = {
  videoId: string;
  videoTitle: string;
  candidates: Array<{ muxAssetId: string; status: string; playbackId: string | null }>;
  /** Fill this in to resolve: paste the muxAssetId you want to use. */
  chosenMuxAssetId: string | null;
};

function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Fetch every asset from Mux (handles pagination). */
async function fetchAllMuxAssets(): Promise<MuxAsset[]> {
  const assets: MuxAsset[] = [];
  let page = await mux.video.assets.list({ limit: 100 });
  while (true) {
    assets.push(...(page.data as MuxAsset[]));
    if (!page.hasNextPage()) break;
    page = await page.getNextPage();
  }
  return assets;
}

async function applyAsset(
  video: { id: string; title: string; videoAssets: Array<{ id: string; muxAssetId: string | null }> },
  muxAsset: MuxAsset
) {
  const playbackId = muxAsset.playback_ids?.[0]?.id ?? null;
  const assetStatus =
    muxAsset.status === "ready"
      ? "READY"
      : muxAsset.status === "errored"
      ? "ERRORED"
      : muxAsset.status === "preparing"
      ? "PROCESSING"
      : "UPLOADED";

  const existingAsset = video.videoAssets.find((va) => !va.muxAssetId);

  if (existingAsset) {
    await prisma.videoAsset.update({
      where: { id: existingAsset.id },
      data: {
        muxAssetId: muxAsset.id,
        muxPlaybackId: playbackId,
        assetStatus,
        durationSeconds: muxAsset.duration ? Math.round(muxAsset.duration) : undefined,
        aspectRatio: muxAsset.aspect_ratio ?? undefined,
      },
    });
    console.log(`               → updated existing VideoAsset (${existingAsset.id})`);
  } else {
    const created = await prisma.videoAsset.create({
      data: {
        videoId: video.id,
        muxAssetId: muxAsset.id,
        muxPlaybackId: playbackId,
        assetStatus,
        playbackPolicy: muxAsset.playback_ids?.[0]?.policy === "public" ? "PUBLIC" : "SIGNED",
        durationSeconds: muxAsset.duration ? Math.round(muxAsset.duration) : undefined,
        aspectRatio: muxAsset.aspect_ratio ?? undefined,
      },
    });
    console.log(`               → created new VideoAsset (${created.id})`);
  }
}

async function main() {
  if (DRY_RUN) console.log("DRY RUN — no changes will be written.\n");
  else if (EXPORT_FILE) console.log(`EXPORT MODE — writing ambiguous entries to ${EXPORT_FILE}\n`);
  else if (RESOLVE_FILE) console.log(`RESOLVE MODE — applying choices from ${RESOLVE_FILE}\n`);
  else console.log("LIVE RUN — changes will be written to the DB.\n");

  // 1. Load DB videos
  const videos = await prisma.video.findMany({
    select: {
      id: true,
      title: true,
      videoAssets: { select: { id: true, muxAssetId: true } },
    },
  });
  console.log(`Loaded ${videos.length} video(s) from DB.`);

  // 2. Fetch Mux assets
  console.log("Fetching assets from Mux...");
  const muxAssets = await fetchAllMuxAssets();
  console.log(`Fetched ${muxAssets.length} asset(s) from Mux.\n`);

  // Build index: normalized title → mux assets
  const muxByTitle = new Map<string, MuxAsset[]>();
  for (const asset of muxAssets) {
    const title = asset.meta?.title;
    if (!title) continue;
    const key = normalize(title);
    if (!muxByTitle.has(key)) muxByTitle.set(key, []);
    muxByTitle.get(key)!.push(asset);
  }

  // Build index: muxAssetId → asset (used when --resolve)
  const muxById = new Map<string, MuxAsset>(muxAssets.map((a) => [a.id, a]));

  // Load resolve file if provided
  let resolveMap = new Map<string, string>(); // videoId → chosenMuxAssetId
  if (RESOLVE_FILE) {
    const entries: AmbiguousEntry[] = JSON.parse(fs.readFileSync(RESOLVE_FILE, "utf8"));
    for (const e of entries) {
      if (e.chosenMuxAssetId) resolveMap.set(e.videoId, e.chosenMuxAssetId);
    }
    console.log(`Loaded ${resolveMap.size} resolved choice(s) from ${RESOLVE_FILE}.\n`);
  }

  let matched = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const video of videos) {
    const key = normalize(video.title);
    const candidates = muxByTitle.get(key) ?? [];

    if (candidates.length === 0) {
      console.log(`[NO MATCH]   "${video.title}"`);
      unmatched++;
      continue;
    }

    // --- Ambiguous: multiple Mux assets share this title ---
    if (candidates.length > 1) {
      // Check if already resolved
      const chosenId = resolveMap.get(video.id);
      const chosenAsset = chosenId ? muxById.get(chosenId) : null;

      if (chosenAsset) {
        // Already resolved by the user
        const alreadyLinked = video.videoAssets.find((va) => va.muxAssetId === chosenAsset.id);
        if (alreadyLinked) {
          console.log(`[SKIP]       "${video.title}" — already linked (assetId=${chosenAsset.id})`);
          skipped++;
          continue;
        }
        console.log(`[RESOLVED]   "${video.title}" → muxAssetId=${chosenAsset.id}  playbackId=${chosenAsset.playback_ids?.[0]?.id ?? "none"}`);
        if (!DRY_RUN) await applyAsset(video, chosenAsset);
        matched++;
      } else {
        // Auto-resolve: prefer ready, then most recently created
        const best = pickBest(candidates);
        const alreadyLinked = video.videoAssets.find((va) => va.muxAssetId === best.id);
        if (alreadyLinked) {
          console.log(`[SKIP]       "${video.title}" — already linked (assetId=${best.id})`);
          skipped++;
          continue;
        }
        console.log(`[AUTO]       "${video.title}" → picked assetId=${best.id}  status=${best.status}  playbackId=${best.playback_ids?.[0]?.id ?? "none"}  (${candidates.length} duplicates)`);
        if (!DRY_RUN) await applyAsset(video, best);
        matched++;
        continue;
      }
    }

    // --- Single match ---
    const muxAsset = candidates[0];
    const alreadyLinked = video.videoAssets.find((va) => va.muxAssetId === muxAsset.id);
    if (alreadyLinked) {
      console.log(`[SKIP]       "${video.title}" — already linked (assetId=${muxAsset.id})`);
      skipped++;
      continue;
    }

    console.log(`[MATCH]      "${video.title}"`);
    console.log(`               muxAssetId=${muxAsset.id}  playbackId=${muxAsset.playback_ids?.[0]?.id ?? "none"}  status=${muxAsset.status}`);
    if (!DRY_RUN) await applyAsset(video, muxAsset);
    matched++;
  }

  console.log(`
─────────────────────────────────
  Matched:   ${matched}
  Skipped:   ${skipped}  (already linked)
  Unmatched: ${unmatched}  (no Mux asset found)
─────────────────────────────────`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
