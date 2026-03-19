import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History, Play, ChevronLeft } from "lucide-react";
import { getWatchHistory } from "@/api/account";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/utils";
import type { WatchHistory } from "@/types";

export default function WatchHistoryPage() {
  const historyQuery = useQuery({
    queryKey: ["account", "watch-history"],
    queryFn: () => getWatchHistory({ perPage: 50 }),
  });

  const items = historyQuery.data?.data ?? [];
  const continueWatching = items.filter((h) => !h.completed);
  const completed = items.filter((h) => h.completed);

  if (historyQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/account">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">Watch History</h1>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center">
          <History className="mx-auto mb-4 h-12 w-12 text-surface-600" />
          <p className="mb-2 text-lg font-medium text-white">
            Nothing here yet
          </p>
          <p className="mb-6 text-surface-400">
            Start watching videos and they&apos;ll show up here.
          </p>
          <Button asChild>
            <Link to="/explore">Explore Content</Link>
          </Button>
        </div>
      ) : (
        <>
          {continueWatching.length > 0 && (
            <HistorySection title="Continue Watching" items={continueWatching} />
          )}
          {completed.length > 0 && (
            <HistorySection title="Completed" items={completed} />
          )}
        </>
      )}
    </div>
  );
}

function HistorySection({
  title,
  items,
}: {
  title: string;
  items: WatchHistory[];
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((h) => (
          <HistoryCard key={h.id} item={h} />
        ))}
      </div>
    </section>
  );
}

function HistoryCard({ item }: { item: WatchHistory }) {
  const video = item.video;
  const progressPct =
    video?.duration && video.duration > 0
      ? Math.min((item.progressSeconds / video.duration) * 100, 100)
      : 0;

  return (
    <Link
      to={video ? `/watch/${video.slug}` : "#"}
      className="group rounded-xl border border-surface-800 bg-surface-900 transition-all hover:border-surface-600"
    >
      <div className="relative aspect-video overflow-hidden rounded-t-xl bg-surface-800">
        {video?.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-surface-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        {!item.completed && progressPct > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-surface-700">
            <div
              className="h-full bg-primary-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-surface-200 group-hover:text-white">
          {video?.title ?? "Video"}
        </h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-surface-500">
            {formatDate(item.lastWatchedAt)}
          </span>
          {item.completed && (
            <Badge variant="success" className="text-[10px]">
              Completed
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
