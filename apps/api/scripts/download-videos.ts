/**
 * Downloads specific videos by title from Toveedo via Mux HLS.
 *
 * Usage:
 *   npx ts-node scripts/download-videos.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = "https://toveedo.com/api";
const EMAIL = "1@1.com";
const PASSWORD = "11111111";
const OUT_DIR = "C:\\Users\\meirs\\Downloads\\videos";

const TITLES = [
  "Device Management",
  "Toveedo Clubhouse",
  "Toveedo Tablet",
  "Toveedo Teaser",
  "Welcome to Toveedo",
];

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = (await res.json()) as { data?: { accessToken?: string } };
  const token = body?.data?.accessToken;
  if (!token) throw new Error("No accessToken in login response");
  return token;
}

// ── Video lookup ──────────────────────────────────────────────────────────────

type VideoResult = {
  title: string;
  muxPlaybackId: string | null;
  playbackPolicy: "PUBLIC" | "SIGNED";
};

async function findVideo(title: string, token: string): Promise<VideoResult | null> {
  const url = `${BASE_URL}/videos?limit=10&search=${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Video search failed: ${res.status}`);
  const body = (await res.json()) as {
    data?: Array<{
      title: string;
      videoAssets?: Array<{ muxPlaybackId?: string | null; playbackPolicy?: string; assetStatus?: string }>;
    }>;
  };

  const videos = body?.data ?? [];
  // exact match (case-insensitive)
  const match = videos.find(
    (v) => v.title.trim().toLowerCase() === title.trim().toLowerCase()
  );
  if (!match) return null;

  const readyAsset = match.videoAssets?.find((a) => a.assetStatus === "READY");
  const asset = readyAsset ?? match.videoAssets?.[0];
  if (!asset?.muxPlaybackId) return null;

  return {
    title: match.title,
    muxPlaybackId: asset.muxPlaybackId,
    playbackPolicy: (asset.playbackPolicy as "PUBLIC" | "SIGNED") ?? "PUBLIC",
  };
}

// ── Signed token ──────────────────────────────────────────────────────────────

function makeSignedToken(playbackId: string): string {
  const privateKeyBase64 = process.env.MUX_SIGNING_KEY_PRIVATE!;
  const keyId = process.env.MUX_SIGNING_KEY_ID!;
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("ascii");
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { sub: playbackId, aud: "v", exp: now + 3600, kid: keyId },
    privateKey,
    { algorithm: "RS256", keyid: keyId }
  );
}

// ── Download ──────────────────────────────────────────────────────────────────

function download(video: VideoResult): void {
  const { muxPlaybackId, playbackPolicy, title } = video;
  if (!muxPlaybackId) return;

  let streamUrl: string;
  if (playbackPolicy === "SIGNED") {
    const token = makeSignedToken(muxPlaybackId);
    streamUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8?token=${token}`;
  } else {
    streamUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8`;
  }

  const safeName = title.replace(/[<>:"/\\|?*]/g, "_");
  const outFile = path.join(OUT_DIR, `${safeName}.mp4`);

  console.log(`  Downloading → ${outFile}`);
  execSync(
    `ffmpeg -y -i "${streamUrl}" -c copy "${outFile}"`,
    { stdio: "inherit" }
  );
  console.log(`  Done.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Logging in...");
  const token = await login();
  console.log("OK\n");

  for (const title of TITLES) {
    console.log(`Looking up: "${title}"`);
    const video = await findVideo(title, token);

    if (!video) {
      console.log(`  [NOT FOUND] No ready video asset for "${title}"\n`);
      continue;
    }

    console.log(`  playbackId=${video.muxPlaybackId}  policy=${video.playbackPolicy}`);
    download(video);
  }

  console.log("All done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
