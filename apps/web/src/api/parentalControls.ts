import { api } from "./client";
import { readGrace } from "./pin";

export type MaturityRating = "G" | "PG" | "PG-13" | "R" | "NR";

export interface ParentalControls {
  maxMaturityRating: MaturityRating;
  blockedCategoryIds: string[];
  dailyTimeLimitMinutes: number | null;
  allowedHours: { start: number; end: number } | null;
  allowPurchases: boolean;
}

export const MATURITY_RATINGS: { value: MaturityRating; label: string }[] = [
  { value: "G", label: "G — All ages" },
  { value: "PG", label: "PG — Parental guidance" },
  { value: "PG-13", label: "PG-13 — Teens" },
  { value: "R", label: "R — Adults" },
  { value: "NR", label: "NR — No restriction" },
];

export async function getParentalControls(
  profileId: string,
): Promise<ParentalControls> {
  const { data } = await api.get(`/profiles/${profileId}/parental-controls`);
  return data.data;
}

export async function updateParentalControls(
  profileId: string,
  patch: Partial<ParentalControls>,
): Promise<ParentalControls> {
  const grace = readGrace("parental");
  const { data } = await api.patch(
    `/profiles/${profileId}/parental-controls`,
    patch,
    grace ? { headers: { "X-Pin-Grace": grace } } : undefined,
  );
  return data.data;
}
