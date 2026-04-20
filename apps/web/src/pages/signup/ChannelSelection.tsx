import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listChannels } from "@/api/channels";
import { useSignup } from "@/pages/auth/SignupPage";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { Bundle, Channel } from "@/types";
import { BundleSection } from "./components/BundleSection";
import { ChannelSection } from "./components/ChannelSection";
import { SignupBottomBar } from "./components/SignupBottomBar";
import { activePlans } from "./utils/variants";

type Filter = "all" | "channels" | "bundles";

export function ChannelSelection() {
  const {
    state,
    selectPlan,
    deselectChannel,
    toggleBundle,
    prev,
    next,
  } = useSignup();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["channels", "signup"],
    queryFn: () => listChannels({ perPage: 50 }),
  });

  const channels = useMemo(
    () =>
      (data?.data ?? []).filter(
        (ch) => activePlans(ch.subscriptionPlans).length > 0,
      ),
    [data],
  );

  const bundleEntries: { bundle: Bundle; channel: Channel }[] = useMemo(
    () =>
      (data?.data ?? []).flatMap(
        (ch) =>
          (ch as Channel & { bundles?: Bundle[] }).bundles?.map((b) => ({
            bundle: b,
            channel: ch,
          })) ?? [],
      ),
    [data],
  );

  const showFilters = channels.length > 0 && bundleEntries.length > 0;
  const showChannels = !showFilters || filter === "all" || filter === "channels";
  const showBundles = !showFilters || filter === "all" || filter === "bundles";

  const selectedVariantIdFor = (channelId: string): string | null => {
    const sel = state.selectedPlans.find((sp) => sp.channel.id === channelId);
    return sel?.variant.id ?? null;
  };

  const isBundleSelected = (bundleId: string) =>
    state.selectedBundles.some((sb) => sb.bundle.id === bundleId);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold text-white">
          Choose your channels and bundles
        </h2>
        <p className="mt-1 text-sm text-surface-400">
          Each channel offers its own plans. Pick the option that fits you for
          each one.
        </p>
      </header>

      {showFilters && (
        <FilterChips
          filter={filter}
          setFilter={setFilter}
          channelsCount={channels.length}
          bundlesCount={bundleEntries.length}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : channels.length === 0 && bundleEntries.length === 0 ? (
        <p className="py-16 text-center text-sm text-surface-500">
          Nothing available yet.
        </p>
      ) : (
        <div className="space-y-4">
          {showChannels &&
            channels.map((channel) => (
              <ChannelSection
                key={channel.id}
                channel={channel}
                selectedVariantId={selectedVariantIdFor(channel.id)}
                onSelect={(plan, variant) =>
                  selectPlan(channel, plan, variant)
                }
                onDeselect={() => deselectChannel(channel.id)}
              />
            ))}

          {showBundles && (
            <BundleSection
              entries={bundleEntries}
              isSelected={isBundleSelected}
              onToggle={(bundle, channel) => toggleBundle(bundle, channel)}
            />
          )}
        </div>
      )}

      <SignupBottomBar
        plans={state.selectedPlans}
        bundles={state.selectedBundles}
        onBack={prev}
        onContinue={next}
      />
    </div>
  );
}

function FilterChips({
  filter,
  setFilter,
  channelsCount,
  bundlesCount,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  channelsCount: number;
  bundlesCount: number;
}) {
  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: channelsCount + bundlesCount },
    { id: "channels", label: "Channels", count: channelsCount },
    { id: "bundles", label: "Bundles", count: bundlesCount },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = filter === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary-500 bg-primary-600 text-white"
                : "border-surface-700 bg-surface-800/50 text-surface-300 hover:border-surface-600 hover:text-white",
            )}
          >
            {chip.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                active
                  ? "bg-white/20 text-white"
                  : "bg-surface-900/80 text-surface-400",
              )}
            >
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
