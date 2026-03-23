import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Search, Tv, X, Lock } from "lucide-react";
import { getContentRows } from "@/api/landing";
import { listChannels } from "@/api/channels";
import { listVideos } from "@/api/videos";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { ContentRow, Video } from "@/types";

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const channelFilter = searchParams.get("channel") ?? "";
  const [searchTerm, setSearchTerm] = useState("");

  const channelsQuery = useQuery({
    queryKey: ["explore", "channels"],
    queryFn: () => listChannels({ perPage: 50 }),
  });

  const rowsQuery = useQuery({
    queryKey: ["explore", "rows", channelFilter],
    queryFn: () =>
      getContentRows(channelFilter ? { channelId: channelFilter } : undefined),
  });

  const searchQuery = useQuery({
    queryKey: ["explore", "search", searchTerm],
    queryFn: () => listVideos({ search: searchTerm, perPage: 24 }),
    enabled: searchTerm.length >= 2,
  });

  const channels = channelsQuery.data?.data ?? [];
  const rows = rowsQuery.data ?? [];
  const searchResults = searchQuery.data?.data ?? [];

  const setChannel = (id: string) => {
    if (id) setSearchParams({ channel: id });
    else setSearchParams({});
  };

  return (
    <div className="min-h-screen bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Search bar */}
        <div className="mb-8">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-500" />
            <Input
              type="search"
              placeholder="Search videos…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 pl-11 pr-10 text-base"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Channel filter pills */}
        {channels.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setChannel("")}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                !channelFilter
                  ? "bg-primary-600 text-white"
                  : "bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white",
              )}
            >
              All
            </button>
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  channelFilter === ch.id
                    ? "bg-primary-600 text-white"
                    : "bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white",
                )}
              >
                {ch.logoUrl ? (
                  <img src={ch.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <Tv className="h-4 w-4" />
                )}
                {ch.name}
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {searchTerm.length >= 2 ? (
          <div>
            <h2 className="mb-6 text-xl font-semibold text-white">
              Results for &ldquo;{searchTerm}&rdquo;
            </h2>
            {searchQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {searchResults.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-surface-600" />
                <p className="text-surface-400">No results found</p>
              </div>
            )}
          </div>
        ) : rowsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-12">
            {rows.map((row) => (
              <ContentSection key={row.id} row={row} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Tv className="mx-auto mb-3 h-10 w-10 text-surface-600" />
            <p className="text-surface-400">No content available yet</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ContentSection({ row }: { row: ContentRow }) {
  const items = row.items ?? [];
  const videos = items
    .map((item) => (item as any).video)
    .filter(Boolean) as Video[];
  if (videos.length === 0) return null;

  return (
    <section>
      <h2 className="mb-5 text-xl font-semibold text-white">{row.title}</h2>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}

function VideoCard({ video }: { video: Video }) {
  const thumbnailUrl =
    (video as any).thumbnailUrl ??
    (video as any).thumbnailAssets?.[0]?.imageUrl ??
    null;

  const duration = video.durationSeconds ?? (video as any).duration ?? null;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <Link
      to={`/videos/${video.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-surface-800 bg-surface-900 transition-all hover:border-surface-600 hover:shadow-lg hover:shadow-black/30"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-surface-800">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-10 w-10 text-surface-600" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/40">
          <div className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>

        {/* Duration badge */}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(duration)}
          </span>
        )}

        {/* Free badge */}
        {video.isFree && (
          <span className="absolute left-2 top-2">
            <Badge className="text-[10px]">Free</Badge>
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-surface-100 group-hover:text-white">
          {video.title}
        </h3>
        {video.channel && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-surface-500">
            {(video.channel as any).logoUrl ? (
              <img
                src={(video.channel as any).logoUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <Tv className="h-3.5 w-3.5" />
            )}
            {video.channel.name}
          </p>
        )}
        {!video.isFree && (
          <p className="mt-auto pt-2 flex items-center gap-1 text-xs text-surface-500">
            <Lock className="h-3 w-3" />
            Subscription required
          </p>
        )}
      </div>
    </Link>
  );
}
