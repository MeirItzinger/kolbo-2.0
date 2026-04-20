import { Check, Package } from "lucide-react";
import type { Bundle, Channel } from "@/types";
import { Button } from "@/components/ui/Button";
import { cn, formatCurrency } from "@/lib/utils";

interface Props {
  bundle: Bundle;
  channel: Channel;
  isSelected: boolean;
  onToggle: () => void;
}

export function BundleTile({ bundle, channel, isSelected, onToggle }: Props) {
  const thumb = (bundle as Bundle & { thumbnailUrl?: string | null })
    .thumbnailUrl;
  const videoCount =
    (bundle as Bundle & { videoIds?: string[] }).videoIds?.length ?? 0;

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface-900 transition-all",
        isSelected
          ? "border-primary-500"
          : "border-surface-800 hover:border-surface-700 hover:bg-surface-900/80",
      )}
    >
      <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-surface-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-200 backdrop-blur">
        <Package className="h-3 w-3" />
        Bundle
      </div>
      {isSelected && (
        <div className="absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="flex h-full w-full flex-col p-5 pt-12 text-left"
      >
        <div className="flex items-start gap-3">
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-800">
              <Package className="h-6 w-6 text-surface-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-white">
              {bundle.name}
            </h3>
            <p className="mt-0.5 text-xs text-surface-400">via {channel.name}</p>
          </div>
        </div>

        {bundle.description && (
          <p className="mt-3 line-clamp-2 text-xs text-surface-400">
            {bundle.description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-surface-500">
              One-time
            </p>
            <p className="text-xl font-semibold text-white tabular-nums">
              {formatCurrency(Number(bundle.price))}
            </p>
            {videoCount > 0 && (
              <p className="mt-0.5 text-[11px] text-surface-500">
                {videoCount} video{videoCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant={isSelected ? "secondary" : "outline"}
            size="sm"
            asChild
          >
            <span>{isSelected ? "Remove" : "Add"}</span>
          </Button>
        </div>
      </button>
    </div>
  );
}
