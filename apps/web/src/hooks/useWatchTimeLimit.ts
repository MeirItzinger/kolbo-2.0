import { useCallback, useEffect, useMemo, useState } from "react";
import type { ParentalControls } from "@/api/parentalControls";

/**
 * Local-only daily watch-time tracker per profile. Counts seconds the user
 * spends on the WatchPage (post-preroll) and persists in localStorage keyed by
 * `<profileId>:<YYYY-MM-DD>` so the budget rolls over at midnight (local time).
 *
 * This is intentionally client-side: it gives an immediate, network-free
 * enforcement on whichever device the kid is using. A future server-side
 * mirror (per-account aggregate) can layer on top without changing this API.
 */

const KEY_PREFIX = "kolbo_watch_seconds_";

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function storageKey(profileId: string): string {
  return `${KEY_PREFIX}${profileId}_${todayKey()}`;
}

function readSeconds(profileId: string): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(storageKey(profileId));
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function writeSeconds(profileId: string, seconds: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(profileId), String(Math.floor(seconds)));
}

function isOutsideAllowedHours(
  controls: ParentalControls | null | undefined,
  now: Date = new Date(),
): boolean {
  const range = controls?.allowedHours;
  if (!range) return false;
  const { start, end } = range;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startMin = start * 60;
  const endMin = end * 60;
  if (startMin === endMin) return false; // 24-hour allow
  if (startMin < endMin) {
    // Same-day window, e.g. 08:00 → 20:00
    return minutesNow < startMin || minutesNow >= endMin;
  }
  // Overnight window, e.g. 20:00 → 06:00
  return minutesNow >= endMin && minutesNow < startMin;
}

export interface WatchTimeStatus {
  /** Seconds already consumed today on this profile. */
  secondsUsed: number;
  /** Daily budget in seconds, or null when no limit is configured. */
  limitSeconds: number | null;
  /** Convenience: true if a limit is configured and has been reached. */
  isOver: boolean;
  /** True if the current time falls outside the profile's allowed-hours window. */
  isOutsideAllowedHours: boolean;
  /** Seconds remaining today (0 when over, Infinity when no limit). */
  remainingSeconds: number;
  /** Add `delta` seconds to today's bucket. Safe no-op when no profile. */
  increment: (delta: number) => void;
  /** Reset today's bucket (used for testing / future "grant 15 more" actions). */
  resetToday: () => void;
}

export function useWatchTimeLimit(
  profileId: string | null | undefined,
  controls: ParentalControls | null | undefined,
): WatchTimeStatus {
  const limitSeconds = useMemo(() => {
    const m = controls?.dailyTimeLimitMinutes;
    if (m === null || m === undefined) return null;
    if (!Number.isFinite(m) || m <= 0) return null;
    return Math.round(m * 60);
  }, [controls?.dailyTimeLimitMinutes]);

  const [secondsUsed, setSecondsUsed] = useState<number>(() =>
    profileId ? readSeconds(profileId) : 0,
  );

  // Re-read when profile changes (active-profile switch).
  useEffect(() => {
    setSecondsUsed(profileId ? readSeconds(profileId) : 0);
  }, [profileId]);

  // Sync across tabs.
  useEffect(() => {
    if (!profileId) return;
    const key = storageKey(profileId);
    function onStorage(e: StorageEvent) {
      if (e.key === key) {
        setSecondsUsed(readSeconds(profileId));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [profileId]);

  const increment = useCallback(
    (delta: number) => {
      if (!profileId || !Number.isFinite(delta) || delta <= 0) return;
      setSecondsUsed((prev) => {
        const next = prev + delta;
        writeSeconds(profileId, next);
        return next;
      });
    },
    [profileId],
  );

  const resetToday = useCallback(() => {
    if (!profileId) return;
    writeSeconds(profileId, 0);
    setSecondsUsed(0);
  }, [profileId]);

  const isOver =
    limitSeconds !== null && secondsUsed >= limitSeconds && !!profileId;
  const remainingSeconds =
    limitSeconds === null ? Number.POSITIVE_INFINITY : Math.max(0, limitSeconds - secondsUsed);

  // Re-evaluate the allowed-hours window once a minute so "outside hours" can
  // kick in mid-session even without prop changes.
  const [tickKey, setTickKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTickKey((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const outside = useMemo(
    () => isOutsideAllowedHours(controls),
    [controls, tickKey],
  );

  return {
    secondsUsed,
    limitSeconds,
    isOver,
    isOutsideAllowedHours: outside,
    remainingSeconds,
    increment,
    resetToday,
  };
}
