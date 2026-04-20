import { Check } from "lucide-react";
import type { PlanPriceVariant } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  autoVariantLabel,
  billingSuffix,
  savingsVsMonthly,
} from "../utils/variants";

interface Props {
  variant: PlanPriceVariant;
  planVariants: PlanPriceVariant[];
  selected: boolean;
  onToggle: () => void;
}

export function VariantCard({
  variant,
  planVariants,
  selected,
  onToggle,
}: Props) {
  const label = autoVariantLabel(variant, planVariants);
  const price = Number(variant.price);
  const suffix = billingSuffix(variant.billingInterval);
  const savings = savingsVsMonthly(variant, planVariants);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
        selected
          ? "border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/30"
          : "border-surface-800 bg-surface-900/50 hover:border-surface-700 hover:bg-surface-900",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary-500 bg-primary-600"
            : "border-surface-600 group-hover:border-surface-500",
        )}
        aria-hidden
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>

      <div className="flex shrink-0 items-baseline gap-0.5">
        {price === 0 ? (
          <span className="text-base font-semibold text-white">Free</span>
        ) : (
          <>
            <span className="text-base font-semibold text-white tabular-nums">
              {formatCurrency(price)}
            </span>
            <span className="text-xs font-medium text-surface-500">
              {suffix}
            </span>
          </>
        )}
      </div>

      <span className="min-w-0 flex-1 truncate text-sm text-surface-300">
        {label}
      </span>

      {savings != null && (
        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
          save {savings}%
        </span>
      )}
    </button>
  );
}
