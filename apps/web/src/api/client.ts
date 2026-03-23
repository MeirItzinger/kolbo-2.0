import axios from "axios";

const TOKEN_KEY = "kolbo_access_token";
const REFRESH_KEY = "kolbo_refresh_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

/**
 * Origin where `/uploads/*` is served (API base URL without `/api`).
 * In production without VITE_API_URL, same tab origin (monorepo on Vercel).
 */
function uploadsAssetBase(): string {
  const vite = import.meta.env.VITE_API_URL;
  if (vite) return vite.replace(/\/api$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * DB rows from local dev often store `http://localhost:4000/uploads/...`.
 * Browsers block those from HTTPS pages (mixed content + loopback). Rewrite to the
 * current deployment’s uploads base (images may still 404 until re-uploaded to Blob).
 */
function rewriteLocalDevUploadsUrl(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    if (!u.pathname.startsWith("/uploads/")) return null;
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    const base = uploadsAssetBase();
    if (!base) return null;
    return `${base}${u.pathname}`;
  } catch {
    return null;
  }
}

/** Absolute URL for display (img src): Blob/CDN or API origin + /uploads path. */
export function resolveUploadedAssetUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return rewriteLocalDevUploadsUrl(pathOrUrl) ?? pathOrUrl;
  }
  const base = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const origin = uploadsAssetBase();
  return origin ? `${origin}${base}` : base;
}

function resolveUploads(value: unknown): unknown {
  if (typeof value === "string") {
    const fromLocal = rewriteLocalDevUploadsUrl(value);
    if (fromLocal) return fromLocal;
    if (value.startsWith("/uploads/")) {
      const origin = uploadsAssetBase();
      return origin ? `${origin}${value}` : value;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(resolveUploads);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveUploads(v);
    return out;
  }
  return value;
}

api.interceptors.response.use(
  (res) => {
    res.data = resolveUploads(res.data);
    return res;
  },
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      clearTokens();
      window.location.href = "/login";
      return Promise.reject(error);
    }
  },
);

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) throw new Error("No refresh token");

  const { data } = await axios.post(
    `${import.meta.env.VITE_API_URL || "/api"}/auth/refresh`,
    { refreshToken },
  );

  const result = data.data ?? data;
  setTokens(result.accessToken, result.refreshToken ?? result.sessionId);
  return result.accessToken;
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
