import { Check, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Bundle, Channel } from "@/types";

interface BundleCardProps {
  bundle: Bundle;
  channel?: Channel;
  isSelected: boolean;
  onToggle: () => void;
}

export function BundleCard({
  bundle,
  channel,
  isSelected,
  onToggle,
}: BundleCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative rounded-xl border bg-surface-900 p-4 text-left transition-all",
        isSelected
          ? "border-primary-500 ring-1 ring-primary-500/30"
          : "border-surface-800 hover:border-surface-600",
      )}
    >
      {isSelected && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600">
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div className="mb-2 flex items-center gap-3">
        {bundle.thumbnailUrl ? (
          <img
            src={bundle.thumbnailUrl}
            alt={bundle.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-800">
            <Package className="h-6 w-6 text-surface-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">{bundle.name}</h3>
          {channel && (
            <p className="text-sm text-surface-400">via {channel.name}</p>
          )}
        </div>
      </div>
      {bundle.description && (
        <p className="mb-3 line-clamp-2 text-sm text-surface-400">
          {bundle.description}
        </p>
      )}
      <p className="text-sm text-surface-400">
        {bundle.videoIds.length} video{bundle.videoIds.length !== 1 ? "s" : ""}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-surface-800 pt-3">
        <span className="text-lg font-semibold text-white">
          {formatCurrency(bundle.price)}
        </span>
        <Badge variant={isSelected ? "default" : "outline"}>
          {isSelected ? "Selected" : "Add"}
        </Badge>
      </div>
    </button>
  );
}
