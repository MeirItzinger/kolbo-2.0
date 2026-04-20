import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
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
  /** Channel slug the viewer is entitled to when session was minted by Kolbo. */
  channelSlug?: string;
}

export interface UscreenLoginResult {
  success: boolean;
  /** Kolbo-minted session token (JWT) — what the client should send back as X-Uscreen-Access-Token. */
  sessionToken?: string;
  /** Raw Uscreen access_token, kept for completeness (not exposed to the browser). */
  uscreenAccessToken?: string;
  refreshToken?: string;
  exp?: number;
  user?: UscreenUserPayload;
  error?: string;
}

// ─── Kolbo-signed Uscreen session token ─────────────────
//
// We used to validate every request by calling Uscreen's `/users/me` with the
// customer's session `access_token`. That endpoint does not exist on the v2
// admin API hosted at api.uscreen.io/api/v2 (the `/users/*` routes there are
// admin-keyed, not customer-session-keyed), so revalidation always failed and
// playback was silently denied. Instead, we now mint a short-lived Kolbo JWT
// at login time and trust our own signature on subsequent requests.

const USCREEN_SESSION_TOKEN_KIND = "uscreen-session";
const USCREEN_SESSION_TTL = "30d";

interface UscreenSessionJwtPayload extends JwtPayload {
  kind: typeof USCREEN_SESSION_TOKEN_KIND;
  /** Stringified Uscreen user id. */
  uid: string;
  email?: string;
  /** Channel slug this session is entitled to (currently always "toveedo"). */
  channelSlug: string;
}

export function createUscreenSessionToken(payload: {
  uscreenUserId: string | number;
  email?: string;
  channelSlug: string;
}): string {
  const body: Omit<UscreenSessionJwtPayload, "iat" | "exp"> = {
    kind: USCREEN_SESSION_TOKEN_KIND,
    uid: String(payload.uscreenUserId),
    email: payload.email,
    channelSlug: payload.channelSlug,
  };
  const options: SignOptions = { expiresIn: USCREEN_SESSION_TTL };
  return jwt.sign(body, env.JWT_ACCESS_SECRET, options);
}

function verifyUscreenSessionToken(
  token: string
): UscreenSessionJwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload & {
      kind?: string;
    };
    if (decoded?.kind !== USCREEN_SESSION_TOKEN_KIND) return null;
    return decoded as UscreenSessionJwtPayload;
  } catch {
    return null;
  }
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
const validationCache = new Map<
  string,
  { expiresAt: number; value: UscreenValidationResult }
>();

function parseUser(response: UscreenMeResponse): UscreenUserPayload | null {
  if (response.user) return response.user;
  if (
    (response as unknown as { data?: { user?: UscreenUserPayload } }).data
      ?.user
  ) {
    return (response as unknown as { data: { user: UscreenUserPayload } }).data
      .user;
  }
  if (response.dataUser) return response.dataUser;
  if (response.data && (response.data.id !== undefined || response.data.email))
    return response.data;
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
 *
 * On success we mint a Kolbo-signed session JWT for the browser to use.
 * The Uscreen `access_token` itself is not exposed to the client; we keep it
 * for potential future server-side Uscreen API calls.
 */
export async function loginViaUscreen(
  email: string,
  password: string,
  channelSlug = "toveedo"
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

    const uscreenUserId = body.user?.id ?? "unknown";
    const sessionToken = createUscreenSessionToken({
      uscreenUserId,
      email: body.user?.email ?? email,
      channelSlug,
    });

    return {
      success: true,
      sessionToken,
      uscreenAccessToken: body.auth.access_token,
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
 * Validate an incoming `X-Uscreen-Access-Token` header.
 *
 * 1. Preferred path: the token is a Kolbo-minted `uscreen-session` JWT.
 *    We verify our own signature and return `valid: true` immediately —
 *    no external network call needed. This is what the webapp sends after
 *    a successful Toveedo login.
 *
 * 2. Fallback path (kept for compatibility / future native Uscreen
 *    integrations that might post a raw Uscreen access_token): call the
 *    configured `USCREEN_ME_PATH` on the Uscreen API with Bearer auth.
 *    If it returns 2xx, accept the token. Failures are logged so we don't
 *    silently deny playback any more.
 */
export async function validateUscreenAccessToken(
  accessToken: string
): Promise<UscreenValidationResult> {
  const token = accessToken.trim();
  if (!token) return { valid: false };

  // Fast path — Kolbo-signed session token.
  const kolboSession = verifyUscreenSessionToken(token);
  if (kolboSession) {
    return {
      valid: true,
      userId: kolboSession.uid,
      email: kolboSession.email,
      channelSlug: kolboSession.channelSlug,
    };
  }

  // Fallback path — raw Uscreen access_token (legacy / future use).
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
      const bodyText = await resp.text().catch(() => "");
      console.warn(
        `[uscreen] /users/me validation failed: status=${resp.status} url=${url} body=${bodyText.slice(0, 200)}`
      );
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
