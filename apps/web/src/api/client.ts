import axios from "axios";

const TOKEN_KEY = "kolbo_access_token";
const REFRESH_KEY = "kolbo_refresh_token";
const USCREEN_TOKEN_KEYS = [
  "kolbo_uscreen_access_token",
  "uscreen_access_token",
  "toveedo_access_token",
] as const;

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
  const uscreenToken = getUscreenAccessToken();
  if (uscreenToken) {
    config.headers["X-Uscreen-Access-Token"] = uscreenToken;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

/**
 * Origin where uploaded files are served (API base URL without trailing `/api`).
 * In production without VITE_API_URL, same tab origin (monorepo on Vercel).
 */
function uploadsAssetBase(): string {
  const vite = import.meta.env.VITE_API_URL;
  if (vite) {
    const stripped = vite.replace(/\/api$/, "");
    if (stripped) return stripped;
    if (typeof window !== "undefined") return window.location.origin;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * On Vercel, `vercel.json` sends `/uploads/*` to the SPA, so those URLs return HTML.
 * The API serverless app only receives `/api/*`, so public files are mounted at `/api/uploads/*`.
 * Use that when the asset origin is the same as the page (single deployment).
 */
function mapUploadsPathForSameOriginDeploy(pathname: string): string {
  if (!pathname.startsWith("/uploads/")) return pathname;
  if (!import.meta.env.PROD) return pathname;
  if (typeof window === "undefined") return pathname;
  const base = uploadsAssetBase();
  if (!base || base !== window.location.origin) return pathname;
  return `/api${pathname}`;
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
    const path = mapUploadsPathForSameOriginDeploy(u.pathname);
    return `${base}${path}`;
  } catch {
    return null;
  }
}

/** Absolute URL for display (img src): Blob/CDN or API origin + /uploads path. */
export function resolveUploadedAssetUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    const fromLocal = rewriteLocalDevUploadsUrl(pathOrUrl);
    if (fromLocal) return fromLocal;
    try {
      const u = new URL(pathOrUrl);
      if (
        u.pathname.startsWith("/uploads/") &&
        typeof window !== "undefined" &&
        import.meta.env.PROD &&
        u.origin === window.location.origin
      ) {
        return `${u.origin}${mapUploadsPathForSameOriginDeploy(u.pathname)}`;
      }
    } catch {
      /* ignore */
    }
    return pathOrUrl;
  }
  const base = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  const origin = uploadsAssetBase();
  const path = mapUploadsPathForSameOriginDeploy(base);
  return origin ? `${origin}${path}` : path;
}

function resolveUploads(value: unknown): unknown {
  if (typeof value === "string") {
    const fromLocal = rewriteLocalDevUploadsUrl(value);
    if (fromLocal) return fromLocal;
    if (value.startsWith("/uploads/")) {
      const origin = uploadsAssetBase();
      const path = mapUploadsPathForSameOriginDeploy(value);
      return origin ? `${origin}${path}` : path;
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
    const accessToken = getAccessToken();

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Uscreen/Toveedo-only sessions do not have Kolbo JWT/refresh tokens.
    // For those sessions, do not run refresh flow or hard-redirect to /login.
    if (!accessToken) {
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

export function getUscreenAccessToken(): string | null {
  for (const key of USCREEN_TOKEN_KEYS) {
    const value = localStorage.getItem(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function setUscreenAccessToken(token: string) {
  localStorage.setItem(USCREEN_TOKEN_KEYS[0], token);
}

export function clearUscreenAccessToken() {
  for (const key of USCREEN_TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
}
