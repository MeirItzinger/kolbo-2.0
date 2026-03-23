import { useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Search, Tv, X, Lock, ChevronLeft, ChevronRight, Compass } from "lucide-react";
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
  const pillsRef = useRef<HTMLDivElement>(null);

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

  const scrollPills = (dir: "left" | "right") => {
    pillsRef.current?.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  };

  const activeChannel = channels.find((ch) => ch.id === channelFilter);

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Page header */}
      <div className="relative overflow-hidden border-b border-surface-800">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/25 via-surface-950 to-surface-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.12),transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-10 sm:px-6 lg:px-8">
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600/20 ring-1 ring-primary-500/30">
              <Compass className="h-4 w-4 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Browse
            </h1>
          </div>
          <p className="mb-6 ml-[42px] text-sm text-surface-400">
            {activeChannel
              ? `Showing content from ${activeChannel.name}`
              : "Discover videos across all channels"}
          </p>

          {/* Search bar */}
          <div className="relative max-w-2xl">
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
      </div>

      {/* Channel filter — sticky horizontal scroll strip */}
      {channels.length > 0 && (
        <div className="sticky top-16 z-10 border-b border-surface-800/60 bg-surface-950/90 backdrop-blur-md">
          <div className="relative mx-auto max-w-7xl">
            {/* Left fade + arrow */}
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-14">
              <div className="h-full w-full bg-gradient-to-r from-surface-950 via-surface-950/80 to-transparent" />
            </div>
            <button
              type="button"
              onClick={() => scrollPills("left")}
              className="absolute left-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-surface-800 p-1 text-surface-300 shadow-md transition-colors hover:bg-surface-700 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div
              ref={pillsRef}
              className="flex gap-2 overflow-x-auto scrollbar-none px-10 py-3"
            >
              <button
                type="button"
                onClick={() => setChannel("")}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  !channelFilter
                    ? "bg-primary-600 text-white shadow-sm shadow-primary-900/60 ring-1 ring-primary-500/50"
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
                    "shrink-0 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                    channelFilter === ch.id
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-900/60 ring-1 ring-primary-500/50"
                      : "bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white",
                  )}
                >
                  {ch.logoUrl ? (
                    <img src={ch.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <Tv className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {ch.name}
                </button>
              ))}
            </div>

            {/* Right fade + arrow */}
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-14">
              <div className="h-full w-full bg-gradient-to-l from-surface-950 via-surface-950/80 to-transparent" />
            </div>
            <button
              type="button"
              onClick={() => scrollPills("right")}
              className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-surface-800 p-1 text-surface-300 shadow-md transition-colors hover:bg-surface-700 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
              <div className="py-20 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-800">
                  <Search className="h-7 w-7 text-surface-500" />
                </div>
                <p className="font-medium text-surface-300">No results found</p>
                <p className="mt-1 text-sm text-surface-500">Try a different search term</p>
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
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-800">
              <Tv className="h-7 w-7 text-surface-500" />
            </div>
            <p className="font-medium text-surface-300">No content available yet</p>
            <p className="mt-1 text-sm text-surface-500">Check back soon</p>
            <Button variant="outline" className="mt-6" asChild>
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
          <p className="mt-auto flex items-center gap-1 pt-2 text-xs text-surface-500">
            <Lock className="h-3 w-3" />
            Subscription required
          </p>
        )}
      </div>
    </Link>
  );
}
