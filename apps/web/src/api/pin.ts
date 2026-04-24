import { api } from "./client";

export type PinScope = "parental" | "profile";

const GRACE_KEY_PREFIX = "kolbo_pin_grace_";

interface GraceEntry {
  token: string;
  /** ms epoch when the locally-cached token expires (server enforces independently). */
  expiresAt: number;
}

/** Local TTL slightly under the server's 15 minutes to reduce flapping. */
const LOCAL_GRACE_TTL_MS = 14 * 60 * 1000;

function key(scope: PinScope, profileId?: string) {
  return scope === "parental"
    ? `${GRACE_KEY_PREFIX}parental`
    : `${GRACE_KEY_PREFIX}profile_${profileId}`;
}

export function readGrace(
  scope: PinScope,
  profileId?: string,
): string | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(key(scope, profileId));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as GraceEntry;
    if (entry.expiresAt < Date.now()) {
      localStorage.removeItem(key(scope, profileId));
      return null;
    }
    return entry.token;
  } catch {
    return null;
  }
}

export function writeGrace(
  scope: PinScope,
  token: string,
  profileId?: string,
) {
  if (typeof localStorage === "undefined") return;
  const entry: GraceEntry = {
    token,
    expiresAt: Date.now() + LOCAL_GRACE_TTL_MS,
  };
  localStorage.setItem(key(scope, profileId), JSON.stringify(entry));
}

export function clearGrace(scope: PinScope, profileId?: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key(scope, profileId));
}

// ── Parental PIN ──────────────────────────────────────────────────────────

export async function getParentalPinStatus(): Promise<{ isSet: boolean }> {
  const { data } = await api.get("/account/parental-pin");
  return data.data;
}

export async function setParentalPin(input: {
  pin: string;
  currentPin?: string;
}): Promise<void> {
  await api.post("/account/parental-pin", input);
}

export async function verifyParentalPin(pin: string): Promise<string> {
  const { data } = await api.post("/account/parental-pin/verify", { pin });
  const token = data.data.graceToken as string;
  writeGrace("parental", token);
  return token;
}

export async function clearParentalPin(currentPin: string): Promise<void> {
  await api.delete("/account/parental-pin", { data: { currentPin } });
  clearGrace("parental");
}

export async function requestParentalPinReset(): Promise<void> {
  await api.post("/account/parental-pin/reset/request", {});
}

export async function confirmParentalPinReset(
  token: string,
  pin: string,
): Promise<void> {
  await api.post("/account/parental-pin/reset/confirm", { token, pin });
  clearGrace("parental");
}

// ── Profile PIN ───────────────────────────────────────────────────────────

export async function getProfilePinStatus(
  profileId: string,
): Promise<{ isSet: boolean }> {
  const { data } = await api.get(`/profiles/${profileId}/pin`);
  return data.data;
}

export async function setProfilePin(
  profileId: string,
  input: { pin: string; currentPin?: string },
): Promise<void> {
  await api.post(`/profiles/${profileId}/pin`, input);
}

export async function verifyProfilePin(
  profileId: string,
  pin: string,
): Promise<string> {
  const { data } = await api.post(`/profiles/${profileId}/pin/verify`, { pin });
  const token = data.data.graceToken as string;
  writeGrace("profile", token, profileId);
  return token;
}

export async function clearProfilePin(
  profileId: string,
  currentPin: string,
): Promise<void> {
  await api.delete(`/profiles/${profileId}/pin`, { data: { currentPin } });
  clearGrace("profile", profileId);
}
