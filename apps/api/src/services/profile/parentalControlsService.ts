import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

export type MaturityRating = "G" | "PG" | "PG-13" | "R" | "NR";

export interface ParentalControls {
  /** Highest maturity rating this profile may watch. */
  maxMaturityRating: MaturityRating;
  /** Channel/category IDs this profile is not allowed to watch. */
  blockedCategoryIds: string[];
  /** Daily watch-time cap, in minutes. null = unlimited. */
  dailyTimeLimitMinutes: number | null;
  /** Allowed window during the day (24h clock). null = always. */
  allowedHours: { start: number; end: number } | null;
  /** Whether this profile may purchase or rent on its own. */
  allowPurchases: boolean;
}

export const DEFAULT_CONTROLS: ParentalControls = {
  maxMaturityRating: "NR",
  blockedCategoryIds: [],
  dailyTimeLimitMinutes: null,
  allowedHours: null,
  allowPurchases: true,
};

const KIDS_DEFAULTS: ParentalControls = {
  maxMaturityRating: "PG",
  blockedCategoryIds: [],
  dailyTimeLimitMinutes: 90,
  allowedHours: { start: 7, end: 20 },
  allowPurchases: false,
};

function defaultsFor(isKidsProfile: boolean): ParentalControls {
  return isKidsProfile ? KIDS_DEFAULTS : DEFAULT_CONTROLS;
}

function normalize(
  raw: unknown,
  isKidsProfile: boolean,
): ParentalControls {
  const base = defaultsFor(isKidsProfile);
  if (!raw || typeof raw !== "object") return base;
  const partial = raw as Partial<ParentalControls>;
  return {
    maxMaturityRating: partial.maxMaturityRating ?? base.maxMaturityRating,
    blockedCategoryIds: Array.isArray(partial.blockedCategoryIds)
      ? partial.blockedCategoryIds.filter((s): s is string => typeof s === "string")
      : base.blockedCategoryIds,
    dailyTimeLimitMinutes:
      typeof partial.dailyTimeLimitMinutes === "number"
        ? partial.dailyTimeLimitMinutes
        : partial.dailyTimeLimitMinutes === null
        ? null
        : base.dailyTimeLimitMinutes,
    allowedHours:
      partial.allowedHours && typeof partial.allowedHours === "object"
        ? {
            start: Number(partial.allowedHours.start) || 0,
            end: Number(partial.allowedHours.end) || 24,
          }
        : partial.allowedHours === null
        ? null
        : base.allowedHours,
    allowPurchases:
      typeof partial.allowPurchases === "boolean"
        ? partial.allowPurchases
        : base.allowPurchases,
  };
}

async function loadProfile(userId: string, profileId: string) {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: {
      id: true,
      isKidsProfile: true,
      parentalControls: true,
    },
  });
  if (!profile) throw ApiError.notFound("Profile not found");
  return profile;
}

export async function getParentalControls(
  userId: string,
  profileId: string,
): Promise<ParentalControls> {
  const profile = await loadProfile(userId, profileId);
  return normalize(profile.parentalControls, profile.isKidsProfile);
}

export async function updateParentalControls(
  userId: string,
  profileId: string,
  patch: Partial<ParentalControls>,
): Promise<ParentalControls> {
  const profile = await loadProfile(userId, profileId);
  const current = normalize(profile.parentalControls, profile.isKidsProfile);
  const next: ParentalControls = {
    maxMaturityRating: patch.maxMaturityRating ?? current.maxMaturityRating,
    blockedCategoryIds:
      patch.blockedCategoryIds ?? current.blockedCategoryIds,
    dailyTimeLimitMinutes:
      patch.dailyTimeLimitMinutes !== undefined
        ? patch.dailyTimeLimitMinutes
        : current.dailyTimeLimitMinutes,
    allowedHours:
      patch.allowedHours !== undefined ? patch.allowedHours : current.allowedHours,
    allowPurchases: patch.allowPurchases ?? current.allowPurchases,
  };

  await prisma.profile.update({
    where: { id: profileId },
    data: {
      parentalControls: next as unknown as Prisma.InputJsonValue,
    },
  });

  return next;
}

export function maturityRank(rating: MaturityRating): number {
  switch (rating) {
    case "G":
      return 0;
    case "PG":
      return 1;
    case "PG-13":
      return 2;
    case "R":
      return 3;
    case "NR":
    default:
      return 99;
  }
}
