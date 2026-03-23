import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Tv, Package } from "lucide-react";
import { listChannels } from "@/api/channels";
import { useSignup } from "@/pages/auth/SignupPage";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn, formatCurrency } from "@/lib/utils";
import type { Channel, SubscriptionPlan, PlanPriceVariant, Bundle } from "@/types";

type Tab = "channels" | "bundles";
type BillingChoice = "MONTHLY" | "YEARLY";

function matchingVariant(
  plan: SubscriptionPlan,
  concurrency: 3 | 5,
  withAds: boolean,
  billingInterval: BillingChoice,
): PlanPriceVariant | undefined {
  const tier = `STREAMS_${concurrency}` as const;
  const ad = withAds ? "WITH_ADS" : "WITHOUT_ADS";
  return (plan.priceVariants ?? []).find(
    (v) =>
      v.isActive &&
      v.billingInterval === billingInterval &&
      v.concurrencyTier === tier &&
      v.adTier === ad,
  );
}

export function ChannelSelection() {
  const {
    state,
    selectPlan,
    deselectChannel,
    toggleBundle,
    prev,
    next,
  } = useSignup();
  const [activeTab, setActiveTab] = useState<Tab>("channels");

  const { data, isLoading } = useQuery({
    queryKey: ["channels", "signup"],
    queryFn: () => listChannels({ perPage: 50 }),
  });

  const channels = (data?.data ?? []).filter(
    (ch) => (ch.subscriptionPlans ?? []).some((p: any) => p.isActive),
  );

  const allBundles: { bundle: Bundle; channel: Channel }[] = channels.flatMap(
    (ch) =>
      (ch as Channel & { bundles?: Bundle[] }).bundles?.map((b) => ({
        bundle: b,
        channel: ch,
      })) ?? [],
  );

  const isBundleSelected = (bundleId: string) =>
    state.selectedBundles.some((sb) => sb.bundle.id === bundleId);

  const total =
    state.selectedPlans.reduce(
      (sum, sp) => sum + Number(sp.variant.price),
      0,
    ) +
    state.selectedBundles.reduce(
      (sum, sb) => sum + Number(sb.bundle.price),
      0,
    );

  const itemCount = state.selectedPlans.length + state.selectedBundles.length;

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-surface-800 bg-surface-900 p-1">
        {(["channels", "bundles"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-surface-800 text-white"
                : "text-surface-400 hover:text-surface-200",
            )}
          >
            {tab === "channels" ? (
              <Tv className="h-4 w-4" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            {tab === "channels" ? "Channels" : "Bundles"}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : activeTab === "channels" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {channels.map((channel) => {
            const sel = state.selectedPlans.find(
              (sp) => sp.channel.id === channel.id,
            );
            return (
              <ChannelCard
                key={channel.id}
                channel={channel}
                selection={sel ?? null}
                onSelect={(plan, variant) => selectPlan(channel, plan, variant)}
                onDeselect={() => deselectChannel(channel.id)}
              />
            );
          })}
          {channels.length === 0 && (
            <p className="col-span-full py-12 text-center text-surface-500">
              No channels available yet.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {allBundles.map(({ bundle, channel }) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              channel={channel}
              isSelected={isBundleSelected(bundle.id)}
              onToggle={() => toggleBundle(bundle, channel)}
            />
          ))}
          {allBundles.length === 0 && (
            <p className="col-span-full py-12 text-center text-surface-500">
              No bundles available yet.
            </p>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between border-t border-surface-800 bg-surface-950/95 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={prev}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-surface-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""} selected
            </p>
            <p className="text-lg font-semibold text-white">
              {formatCurrency(total)}
            </p>
          </div>
          <Button onClick={next}>
            Review Order
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Toggle helper ───────────────────────────────────────────────────

function MiniToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-surface-500">{label}</span>
      <div className="flex rounded border border-surface-700 bg-surface-800">
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2 py-0.5 text-[11px] font-medium transition-colors",
              value === opt.value
                ? "bg-primary-600 text-white"
                : "text-surface-400 hover:text-white",
              i === 0 && "rounded-l",
              i === options.length - 1 && "rounded-r",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Channel Card ────────────────────────────────────────────────────

function ChannelCard({
  channel,
  selection,
  onSelect,
  onDeselect,
}: {
  channel: Channel;
  selection: { plan: SubscriptionPlan; variant: PlanPriceVariant } | null;
  onSelect: (plan: SubscriptionPlan, variant: PlanPriceVariant) => void;
  onDeselect: () => void;
}) {
  const [billing, setBilling] = useState<BillingChoice>("MONTHLY");
  const [concurrency, setConcurrency] = useState<3 | 5>(3);
  const [withAds, setWithAds] = useState(false);

  useEffect(() => {
    const v = selection?.variant;
    if (!v) return;
    if (v.billingInterval === "MONTHLY" || v.billingInterval === "YEARLY") {
      setBilling(v.billingInterval);
    }
    if (v.concurrencyTier === "STREAMS_3") setConcurrency(3);
    else if (v.concurrencyTier === "STREAMS_5") setConcurrency(5);
    setWithAds(v.adTier === "WITH_ADS");
  }, [selection?.variant?.id]);

  const plans = (channel.subscriptionPlans ?? []).filter((p) => p.isActive);

  const plansWithPrice = plans
    .map((plan) => ({
      plan,
      variant: matchingVariant(plan, concurrency, withAds, billing),
    }))
    .filter(
      (x): x is { plan: SubscriptionPlan; variant: PlanPriceVariant } =>
        !!x.variant,
    );

  const isSelected = !!selection;

  const handlePlanClick = (plan: SubscriptionPlan, variant: PlanPriceVariant) => {
    if (selection?.plan.id === plan.id && selection?.variant.id === variant.id) {
      onDeselect();
    } else {
      onSelect(plan, variant);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface-900 p-5 transition-all",
        isSelected
          ? "border-primary-500 ring-1 ring-primary-500/30"
          : "border-surface-800 hover:border-surface-600",
      )}
    >
      {isSelected && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 shadow-lg">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-800">
            <Tv className="h-6 w-6 text-surface-500" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">
            {channel.name}
          </h3>
          {channel.shortDescription && (
            <p className="line-clamp-1 text-xs text-surface-400">
              {channel.shortDescription}
            </p>
          )}
        </div>
      </div>

      {/* Per-card toggles */}
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border border-surface-800 bg-surface-800/40 px-3 py-2">
        <MiniToggle
          label="Billing"
          value={billing}
          onChange={setBilling}
          options={[
            { value: "MONTHLY", label: "Mo" },
            { value: "YEARLY", label: "Yr" },
          ]}
        />
        <MiniToggle
          label="Streams"
          value={String(concurrency) as "3" | "5"}
          onChange={(v) => setConcurrency(Number(v) as 3 | 5)}
          options={[
            { value: "3", label: "3" },
            { value: "5", label: "5" },
          ]}
        />
        <MiniToggle
          label="Ads"
          value={withAds ? "yes" : "no"}
          onChange={(v) => setWithAds(v === "yes")}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
        />
      </div>

      {/* Plan options */}
      {plansWithPrice.length > 0 ? (
        <div className="mt-auto space-y-2">
          {plansWithPrice.map(({ plan, variant }) => {
            const active =
              selection?.plan.id === plan.id &&
              selection?.variant.id === variant.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handlePlanClick(plan, variant)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "border-primary-500 bg-primary-600/10 text-white"
                    : "border-surface-700 bg-surface-800 text-surface-300 hover:border-surface-600 hover:text-white",
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    active
                      ? "border-primary-500 bg-primary-600"
                      : "border-surface-600",
                  )}
                >
                  {active && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className="flex-1 whitespace-nowrap">{plan.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatCurrency(Number(variant.price))}
                  <span className="text-xs font-normal text-surface-400">
                    /{billing === "YEARLY" ? "yr" : "mo"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-auto pt-2 text-center text-xs text-surface-500">
          No plans for this configuration
        </p>
      )}
    </div>
  );
}

// ── Bundle Card ─────────────────────────────────────────────────────

function BundleCard({
  bundle,
  channel,
  isSelected,
  onToggle,
}: {
  bundle: Bundle;
  channel: Channel;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative rounded-xl border bg-surface-900 p-5 text-left transition-all",
        isSelected
          ? "border-primary-500 ring-1 ring-primary-500/30"
          : "border-surface-800 hover:border-surface-600",
      )}
    >
      {isSelected && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 shadow-lg">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        {bundle.thumbnailUrl ? (
          <img
            src={bundle.thumbnailUrl}
            alt={bundle.name}
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-800">
            <Package className="h-6 w-6 text-surface-500" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{bundle.name}</h3>
          <p className="text-sm text-surface-400">via {channel.name}</p>
        </div>
      </div>

      {bundle.description && (
        <p className="mb-3 line-clamp-2 text-sm text-surface-400">
          {bundle.description}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-surface-800 pt-3">
        <div>
          <span className="text-lg font-semibold text-white">
            {formatCurrency(Number(bundle.price))}
          </span>
          <span className="ml-1 text-xs text-surface-400">
            · {bundle.videoIds?.length ?? 0} video
            {(bundle.videoIds?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <Badge variant={isSelected ? "default" : "outline"}>
          {isSelected ? "Selected" : "Add"}
        </Badge>
      </div>
    </button>
  );
}
