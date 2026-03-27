import { env } from "../../config/env";

// ─── Types ──────────────────────────────────────────────

interface UscreenUserPayload {
  id?: string | number;
  email?: string;
  name?: string;
  subscribed?: boolean;
}

interface UscreenMeResponse {
  user?: UscreenUserPayload;
  data?: UscreenUserPayload;
  // Some Uscreen responses wrap user under `data.user`.
  // Keep this optional and permissive to avoid false negatives.
  dataUser?: UscreenUserPayload;
  id?: string | number;
  email?: string;
}

interface UscreenLoginResponse {
  user: UscreenUserPayload;
  subscription?: unknown;
  auth: {
    access_token: string;
    refresh_token: string;
    exp: number;
  };
}

export interface UscreenValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
}

export interface UscreenLoginResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  exp?: number;
  user?: UscreenUserPayload;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────

function uscreenBaseUrl(): string {
  return env.USCREEN_API_BASE_URL.replace(/\/+$/, "");
}

function storeTokenHeader(): Record<string, string> {
  const token = env.USCREEN_STORE_TOKEN;
  return token ? { "X-Store-Token": token } : {};
}

const CACHE_TTL_MS = 60_000;
const validationCache = new Map<string, { expiresAt: number; value: UscreenValidationResult }>();

function parseUser(response: UscreenMeResponse): UscreenUserPayload | null {
  if (response.user) return response.user;
  if ((response as unknown as { data?: { user?: UscreenUserPayload } }).data?.user) {
    return (response as unknown as { data: { user: UscreenUserPayload } }).data.user;
  }
  if (response.dataUser) return response.dataUser;
  if (response.data && (response.data.id !== undefined || response.data.email)) return response.data;
  if (response.id !== undefined || response.email) {
    return { id: response.id, email: response.email };
  }
  return null;
}

function cacheGet(token: string): UscreenValidationResult | null {
  const hit = validationCache.get(token);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    validationCache.delete(token);
    return null;
  }
  return hit.value;
}

function cacheSet(token: string, value: UscreenValidationResult): void {
  validationCache.set(token, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value,
  });
}

// ─── Login via Uscreen ──────────────────────────────────

/**
 * Authenticate a user against the Uscreen API using email + password.
 * Mirrors the toveedo tablet app: `POST /sessions` with `X-Store-Token`.
 */
export async function loginViaUscreen(
  email: string,
  password: string
): Promise<UscreenLoginResult> {
  const url = `${uscreenBaseUrl()}/sessions`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...storeTokenHeader(),
      },
      body: JSON.stringify({ email, password, device: "web" }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(`[uscreen] Login failed (${resp.status}): ${text}`);
      return { success: false, error: "Invalid Uscreen credentials" };
    }

    const body = (await resp.json()) as UscreenLoginResponse;
    if (!body.auth?.access_token) {
      return { success: false, error: "Unexpected Uscreen response" };
    }

    return {
      success: true,
      accessToken: body.auth.access_token,
      refreshToken: body.auth.refresh_token,
      exp: body.auth.exp,
      user: body.user,
    };
  } catch (err) {
    console.warn("[uscreen] Login request error:", err);
    return { success: false, error: "Could not reach Uscreen" };
  }
}

// ─── Validate existing token ────────────────────────────

/**
 * Validate an end-user Uscreen access token by querying `/users/me`.
 * Returns `valid: true` for any successful user payload.
 */
export async function validateUscreenAccessToken(
  accessToken: string
): Promise<UscreenValidationResult> {
  const token = accessToken.trim();
  if (!token) return { valid: false };

  const cached = cacheGet(token);
  if (cached) return cached;

  const mePath = env.USCREEN_ME_PATH.startsWith("/")
    ? env.USCREEN_ME_PATH
    : `/${env.USCREEN_ME_PATH}`;
  const url = `${uscreenBaseUrl()}${mePath}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...storeTokenHeader(),
      },
    });

    if (!resp.ok) {
      const invalid = { valid: false };
      cacheSet(token, invalid);
      return invalid;
    }

    // Any 2xx response from Uscreen means the token is accepted by their API.
    // We still try to extract user details, but do not fail entitlement if the
    // payload shape changes or is empty (e.g. 204 / minimal body).
    let user: UscreenUserPayload | null = null;
    let parseFailed = false;
    try {
      const text = await resp.text();
      if (text.trim()) {
        const body = JSON.parse(text) as UscreenMeResponse;
        user = parseUser(body);
      }
    } catch {
      parseFailed = true;
    }

    if (parseFailed) {
      const invalid = { valid: false };
      cacheSet(token, invalid);
      return invalid;
    }

    const valid: UscreenValidationResult = user
      ? {
          valid: true,
          userId: user.id !== undefined ? String(user.id) : undefined,
          email: user.email,
        }
      : { valid: true };
    cacheSet(token, valid);
    return valid;
  } catch (err) {
    console.warn("[uscreen] Failed to validate access token:", err);
    return { valid: false };
  }
}
