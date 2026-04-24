import { useCallback } from "react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { MaturityRating } from "@/api/parentalControls";

const RANK: Record<string, number> = {
  G: 0,
  PG: 1,
  "PG-13": 2,
  R: 3,
  NR: 99,
};

function rank(rating?: string | null): number {
  if (!rating) return RANK.NR;
  return RANK[rating] ?? RANK.NR;
}

export interface MaturityCheckable {
  maturityRating?: string | null;
}

/**
 * Returns helpers driven by the active profile's parental controls.
 * - `isAllowed(video)` decides whether a single item passes the cap.
 * - `filter(items)` keeps only items the profile is allowed to see.
 * When no profile is active, everything is allowed.
 */
export function useMaturityFilter() {
  const { parentalControls } = useActiveProfile();
  const cap: MaturityRating = parentalControls?.maxMaturityRating ?? "NR";
  const capRank = rank(cap);

  const isAllowed = useCallback(
    (item: MaturityCheckable | null | undefined) => {
      if (!item) return true;
      const itemRank = rank(item.maturityRating);
      // NR (99) items are allowed only when the cap itself is NR.
      if (itemRank === RANK.NR) return capRank === RANK.NR;
      return itemRank <= capRank;
    },
    [capRank],
  );

  const filter = useCallback(
    <T extends MaturityCheckable>(items: T[] | undefined): T[] => {
      if (!items?.length) return items ?? [];
      // No active profile: don't restrict anything.
      if (!parentalControls) return items;
      return items.filter((item) => isAllowed(item));
    },
    [isAllowed, parentalControls],
  );

  return {
    activeRatingCap: cap,
    isAllowed,
    filter,
  };
}
