import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { Video } from "@/types";

interface VideoCardProps {
  video: Video;
  className?: string;
  showChannel?: boolean;
  progress?: number;
}

function thumbnailGradient(title: string) {
  const hash = [...title].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue}, 40%, 25%), hsl(${(hue + 60) % 360}, 30%, 15%))`;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoCard({
  video,
  className,
  showChannel = true,
  progress,
}: VideoCardProps) {
  const accessLabel = video.isFree
    ? "Free"
    : video.rentalOption
      ? "Rental"
      : video.purchaseOption
        ? "Purchase"
        : "Subscription";

  return (
    <Link
      to={`/videos/${video.slug}`}
      className={cn("group/card w-[220px] shrink-0 sm:w-[260px]", className)}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ background: thumbnailGradient(video.title) }}
          >
            <Play className="h-8 w-8 text-surface-400" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/card:bg-black/30">
          <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover/card:opacity-100" />
        </div>
        {video.duration != null && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(video.duration)}
          </span>
        )}
        <div className="absolute left-2 top-2">
          <Badge
            variant={video.isFree ? "success" : "secondary"}
            className="text-[10px]"
          >
            {accessLabel}
          </Badge>
        </div>
        {progress != null && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-700">
            <div
              className="h-full bg-primary-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium text-surface-200 group-hover/card:text-white">
        {video.title}
      </h3>
      {showChannel && video.channel && (
        <p className="mt-0.5 text-xs text-surface-500">{video.channel.name}</p>
      )}
    </Link>
  );
}
