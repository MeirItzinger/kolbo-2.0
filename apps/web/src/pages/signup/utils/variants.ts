import type {
  AdTier,
  BillingInterval,
  ConcurrencyTier,
  PlanPriceVariant,
  SubscriptionPlan,
} from "@/types";

const STREAM_NUMBER: Record<ConcurrencyTier, number> = {
  STREAMS_1: 1,
  STREAMS_3: 3,
  STREAMS_5: 5,
};

const BILLING_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const AD_LABELS: Record<AdTier, string> = {
  WITHOUT_ADS: "ad-free",
  WITH_ADS: "with ads",
};

const BILLING_SUFFIX: Record<BillingInterval, string> = {
  MONTHLY: "/mo",
  YEARLY: "/yr",
};

export function activeVariants(plan: SubscriptionPlan): PlanPriceVariant[] {
  return (plan.priceVariants ?? []).filter((v) => v.isActive);
}

export function activePlans(
  plans: SubscriptionPlan[] | undefined,
): SubscriptionPlan[] {
  return (plans ?? []).filter(
    (p) => p.isActive && activeVariants(p).length > 0,
  );
}

export function monthlyEquivalent(v: PlanPriceVariant): number {
  const price = Number(v.price);
  return v.billingInterval === "YEARLY" ? price / 12 : price;
}

export function billingSuffix(b: BillingInterval): string {
  return BILLING_SUFFIX[b];
}

export function billingLabel(b: BillingInterval): string {
  return BILLING_LABELS[b];
}

export function streamsLabel(t: ConcurrencyTier): string {
  const n = STREAM_NUMBER[t];
  if (n === 1) return "1 stream";
  return `${n} streams`;
}

export function adsLabel(a: AdTier): string {
  return AD_LABELS[a];
}

export interface SummaryParts {
  planName: string;
  billing: string;
  streams: string;
  ads: string;
}

export function summarizeSelection(
  plan: SubscriptionPlan,
  variant: PlanPriceVariant,
): SummaryParts {
  return {
    planName: plan.name,
    billing: billingLabel(variant.billingInterval),
    streams: streamsLabel(variant.concurrencyTier),
    ads: adsLabel(variant.adTier),
  };
}

/**
 * Short attribute string for a variant row, e.g. "3 streams · ad-free".
 *
 * Trims dimensions that are constant across the plan (no information value)
 * and uses billing only as a last-resort discriminator when ads/streams are
 * uniform but billing differs. Billing is intentionally omitted when the
 * price suffix already conveys it, which is the common case.
 */
export function autoVariantLabel(
  variant: PlanPriceVariant,
  planVariants: PlanPriceVariant[],
): string {
  const streamsValues = new Set(planVariants.map((v) => v.concurrencyTier));
  const adsValues = new Set(planVariants.map((v) => v.adTier));
  const billingValues = new Set(planVariants.map((v) => v.billingInterval));

  const parts: string[] = [];

  if (streamsValues.size > 1) {
    parts.push(streamsLabel(variant.concurrencyTier));
  }
  if (adsValues.size > 1) {
    parts.push(adsLabel(variant.adTier));
  }

  if (parts.length === 0) {
    if (billingValues.size > 1) {
      return billingLabel(variant.billingInterval);
    }
    if (planVariants.length === 1) {
      return [
        streamsLabel(variant.concurrencyTier),
        adsLabel(variant.adTier),
      ].join(" · ");
    }
    return "Standard";
  }

  return parts.join(" · ");
}

function variantSortKey(v: PlanPriceVariant): [number, number, number] {
  const streams = STREAM_NUMBER[v.concurrencyTier];
  const ads = v.adTier === "WITH_ADS" ? 0 : 1;
  const billing = v.billingInterval === "MONTHLY" ? 0 : 1;
  return [streams, ads, billing];
}

function compareVariants(a: PlanPriceVariant, b: PlanPriceVariant): number {
  const [as, aa, ab] = variantSortKey(a);
  const [bs, ba, bb] = variantSortKey(b);
  if (as !== bs) return as - bs;
  if (aa !== ba) return aa - ba;
  if (ab !== bb) return ab - bb;
  return Number(a.price) - Number(b.price);
}

export interface PlanGroup {
  plan: SubscriptionPlan;
  variants: PlanPriceVariant[];
}

/**
 * Groups a channel's plans with their active variants. Variants are sorted
 * within each plan by streams asc → ads (with-ads first) → billing (monthly
 * first), producing a natural cheap-to-expensive reading order. Plan groups
 * are ordered by their cheapest variant (per-month equivalent).
 */
export function groupVariantsByPlan(
  plans: SubscriptionPlan[] | undefined,
): PlanGroup[] {
  const groups: PlanGroup[] = activePlans(plans).map((plan) => ({
    plan,
    variants: activeVariants(plan).slice().sort(compareVariants),
  }));
  groups.sort((a, b) => {
    const aMin = a.variants.length
      ? Math.min(...a.variants.map(monthlyEquivalent))
      : 0;
    const bMin = b.variants.length
      ? Math.min(...b.variants.map(monthlyEquivalent))
      : 0;
    return aMin - bMin;
  });
  return groups;
}

/**
 * Calculates the discount % a yearly variant offers vs an equivalent
 * monthly variant in the same plan. Returns null when:
 *   - the variant isn't yearly
 *   - the price is zero (free; no discount math)
 *   - no monthly comparator exists in the same plan
 *   - the math comes out non-positive
 *
 * Match order: same (streams, ads) → same streams (any ads) → cheapest monthly.
 * The fallback chain handles sparse matrices where channel owners only
 * publish a subset of combinations.
 */
export function savingsVsMonthly(
  variant: PlanPriceVariant,
  planVariants: PlanPriceVariant[],
): number | null {
  if (variant.billingInterval !== "YEARLY") return null;
  const yearlyPrice = Number(variant.price);
  if (yearlyPrice <= 0) return null;

  const monthlyVariants = planVariants.filter(
    (v) => v.billingInterval === "MONTHLY" && Number(v.price) > 0,
  );
  if (monthlyVariants.length === 0) return null;

  const exactTier = monthlyVariants.find(
    (v) =>
      v.concurrencyTier === variant.concurrencyTier &&
      v.adTier === variant.adTier,
  );
  const sameStreams = monthlyVariants.find(
    (v) => v.concurrencyTier === variant.concurrencyTier,
  );
  const cheapest = monthlyVariants
    .slice()
    .sort((a, b) => Number(a.price) - Number(b.price))[0];
  const monthly = exactTier ?? sameStreams ?? cheapest;
  if (!monthly) return null;

  const monthlyPrice = Number(monthly.price);
  const equivalentYearly = monthlyPrice * 12;
  if (equivalentYearly <= 0) return null;

  const savings = Math.round((1 - yearlyPrice / equivalentYearly) * 100);
  return savings > 0 ? savings : null;
}
