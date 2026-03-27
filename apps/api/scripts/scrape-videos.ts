/**
 * Scrapes all videos (and categories) from the Toveedo API and saves to JSON.
 *
 * Usage:
 *   npx ts-node scripts/scrape-videos.ts
 *   npx ts-node scripts/scrape-videos.ts --base-url https://toveedo.com --out videos.json
 *   npx ts-node scripts/scrape-videos.ts --no-categories
 */

import * as fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const BASE_URL = flag("--base-url", "https://toveedo.com");
const API = `${BASE_URL}/api`;
const OUT_FILE = flag("--out", path.resolve(__dirname, "scraped-videos.json"));
const SKIP_CATEGORIES = args.includes("--no-categories");
const PAGE_SIZE = 250;

const EMAIL = flag("--email", "1@1.com");
const PASSWORD = flag("--password", "11111111");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${url}\n${text}`);
  }
  return res.json();
}

async function login(): Promise<string> {
  const body = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }) as { data?: { accessToken?: string } };

  const token = body?.data?.accessToken;
  if (!token) throw new Error("Login failed — no accessToken in response");
  console.log("Logged in OK.");
  return token;
}

async function fetchAllVideos(token: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const res = await apiFetch(
      `/videos?limit=${PAGE_SIZE}&page=${page}&sortBy=createdAt&order=asc`,
      { headers: { Authorization: `Bearer ${token}` } }
    ) as { data?: unknown[]; meta?: { total?: number } };

    const items = res?.data ?? [];
    if (items.length === 0) break;

    all.push(...items);
    total = res?.meta?.total ?? all.length;
    console.log(`  Page ${page}: fetched ${items.length} — total so far: ${all.length} / ${total}`);
    page++;
  }

  return all;
}

async function fetchCategories(token: string): Promise<unknown[]> {
  const res = await apiFetch("/categories", {
    headers: { Authorization: `Bearer ${token}` },
  }) as { data?: unknown[] };
  return res?.data ?? (Array.isArray(res) ? (res as unknown[]) : []);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Output   : ${OUT_FILE}\n`);

  const token = await login();

  console.log("\nFetching videos...");
  const videos = await fetchAllVideos(token);
  console.log(`Fetched ${videos.length} video(s) total.\n`);

  let categories: unknown[] = [];
  if (!SKIP_CATEGORIES) {
    console.log("Fetching categories...");
    categories = await fetchCategories(token);
    console.log(`Fetched ${categories.length} category/categories.\n`);
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    totals: {
      videos: videos.length,
      categories: categories.length,
    },
    categories,
    videos,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
  console.log(`Saved to ${OUT_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
