import { Check, Tv } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { Channel } from "@/types";

interface ChannelCardProps {
  channel: Channel;
  isSelected: boolean;
  price?: number;
  onToggle: () => void;
}

export function ChannelCard({
  channel,
  isSelected,
  price,
  onToggle,
}: ChannelCardProps) {
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
      <div className="flex items-center gap-3">
        {channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-800">
            <Tv className="h-6 w-6 text-surface-500" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white">{channel.name}</h3>
          {price != null && (
            <p className="text-sm text-surface-400">
              {formatCurrency(price)}/mo
            </p>
          )}
        </div>
      </div>
      {channel.description && (
        <p className="mt-3 line-clamp-2 text-sm text-surface-400">
          {channel.description}
        </p>
      )}
    </button>
  );
}
