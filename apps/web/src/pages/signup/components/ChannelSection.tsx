import { Tv } from "lucide-react";
import type {
  Channel,
  PlanPriceVariant,
  SubscriptionPlan,
} from "@/types";
import { groupVariantsByPlan } from "../utils/variants";
import { VariantCard } from "./VariantCard";

interface Props {
  channel: Channel;
  selectedVariantId: string | null;
  onSelect: (plan: SubscriptionPlan, variant: PlanPriceVariant) => void;
  onDeselect: () => void;
}

export function ChannelSection({
  channel,
  selectedVariantId,
  onSelect,
  onDeselect,
}: Props) {
  const groups = groupVariantsByPlan(channel.subscriptionPlans);
  const totalVariants = groups.reduce((s, g) => s + g.variants.length, 0);
  const showPlanHeadings = groups.length > 1;
  const isSelected = selectedVariantId !== null;

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-800 bg-surface-950/40 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]">
      <header className="relative flex items-start gap-4 border-b border-surface-800 bg-gradient-to-br from-surface-800/70 via-surface-900/60 to-surface-900/30 px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${
            isSelected ? "bg-primary-500" : "bg-surface-700/60"
          }`}
        />
        {channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-surface-700/80"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-800 ring-1 ring-surface-700/80">
            <Tv className="h-7 w-7 text-surface-500" />
          </div>
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-white">
              {channel.name}
            </h3>
            {totalVariants > 0 && (
              <span className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
                {totalVariants} option{totalVariants === 1 ? "" : "s"}
              </span>
            )}
            {isSelected && (
              <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-300">
                Selected
              </span>
            )}
          </div>
          {channel.shortDescription && (
            <p className="mt-1 line-clamp-2 text-sm text-surface-400">
              {channel.shortDescription}
            </p>
          )}
        </div>
      </header>

      {totalVariants === 0 ? (
        <div className="px-4 py-6 sm:px-5">
          <p className="rounded-lg border border-dashed border-surface-800 px-3 py-6 text-center text-sm text-surface-500">
            No plans available right now.
          </p>
        </div>
      ) : (
        <div className="space-y-5 px-4 py-5 sm:px-5">
          {groups.map(({ plan, variants }) => (
            <div key={plan.id}>
              {showPlanHeadings && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-px flex-1 bg-surface-800" aria-hidden />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-300">
                    {plan.name}
                  </h4>
                  <span className="h-px flex-1 bg-surface-800" aria-hidden />
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {variants.map((variant) => (
                  <VariantCard
                    key={variant.id}
                    variant={variant}
                    planVariants={variants}
                    selected={selectedVariantId === variant.id}
                    onToggle={() => {
                      if (selectedVariantId === variant.id) onDeselect();
                      else onSelect(plan, variant);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
