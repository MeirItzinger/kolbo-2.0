import { Check, Package } from "lucide-react";
import type { Bundle, Channel } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";

interface BundleEntry {
  bundle: Bundle;
  channel: Channel;
}

interface Props {
  entries: BundleEntry[];
  isSelected: (bundleId: string) => boolean;
  onToggle: (bundle: Bundle, channel: Channel) => void;
}

export function BundleSection({ entries, isSelected, onToggle }: Props) {
  if (entries.length === 0) return null;
  const selectedCount = entries.reduce(
    (n, e) => (isSelected(e.bundle.id) ? n + 1 : n),
    0,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-800 bg-surface-950/40">
      <header className="relative flex items-start gap-4 border-b border-surface-800 bg-gradient-to-br from-surface-800/70 via-surface-900/60 to-surface-900/30 px-4 py-4 sm:px-5">
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1 ${
            selectedCount > 0 ? "bg-primary-500" : "bg-surface-700/60"
          }`}
        />
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-800 ring-1 ring-surface-700/80">
          <Package className="h-7 w-7 text-surface-500" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-lg font-semibold tracking-tight text-white">
              Bundles
            </h3>
            <span className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
              {entries.length} bundle{entries.length === 1 ? "" : "s"}
            </span>
            {selectedCount > 0 && (
              <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-300">
                {selectedCount} added
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-surface-400">
            One-time purchases of curated content.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2 px-4 py-5 sm:grid-cols-2 sm:px-5">
        {entries.map(({ bundle, channel }) => (
          <BundleRow
            key={bundle.id}
            bundle={bundle}
            channel={channel}
            selected={isSelected(bundle.id)}
            onToggle={() => onToggle(bundle, channel)}
          />
        ))}
      </div>
    </section>
  );
}

function BundleRow({
  bundle,
  channel,
  selected,
  onToggle,
}: {
  bundle: Bundle;
  channel: Channel;
  selected: boolean;
  onToggle: () => void;
}) {
  const videoCount =
    (bundle as Bundle & { videoIds?: string[] }).videoIds?.length ?? 0;
  const price = Number(bundle.price);

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
            <span className="text-xs font-medium text-surface-400">
              one-time
            </span>
          </>
        )}
      </div>

      <span className="min-w-0 flex-1 truncate text-sm text-surface-200">
        <span className="font-medium">{bundle.name}</span>
        <span className="ml-2 text-surface-500">via {channel.name}</span>
      </span>

      {videoCount > 0 && (
        <span className="shrink-0 rounded-full bg-surface-800 px-2 py-0.5 text-[11px] font-medium text-surface-300">
          {videoCount} video{videoCount === 1 ? "" : "s"}
        </span>
      )}
    </button>
  );
}
