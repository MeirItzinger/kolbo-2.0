type HeaderValue = string | string[] | undefined;

function firstHeader(value: HeaderValue): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? null;
  return null;
}

export function extractUscreenAccessToken(headers: {
  "x-uscreen-access-token"?: HeaderValue;
  "x-uscreen-token"?: HeaderValue;
}): string | null {
  const explicit =
    firstHeader(headers["x-uscreen-access-token"]) ??
    firstHeader(headers["x-uscreen-token"]);
  if (explicit?.trim()) return explicit.trim();
  return null;
}
