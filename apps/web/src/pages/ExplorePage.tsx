import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Search,
  Tv,
  X,
} from "lucide-react";
import { getContentRows } from "@/api/landing";
import { listChannels } from "@/api/channels";
import { listVideos } from "@/api/videos";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
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
    queryFn: () => listVideos({ search: searchTerm, perPage: 20 }),
    enabled: searchTerm.length >= 2,
  });

  const channels = channelsQuery.data?.data ?? [];
  const rows = rowsQuery.data ?? [];
  const searchResults = searchQuery.data?.data ?? [];

  const setChannel = (id: string) => {
    if (id) {
      setSearchParams({ channel: id });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="min-h-screen bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search bar */}
        <div className="mb-8">
          <div className="relative mx-auto max-w-xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-500" />
            <Input
              type="search"
              placeholder="Search videos…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 pl-10 pr-10 text-base"
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
                  <img
                    src={ch.logoUrl}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
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
            <h2 className="mb-4 text-lg font-semibold text-white">
              Search results for &ldquo;{searchTerm}&rdquo;
            </h2>
            {searchQuery.isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {searchResults.map((video) => (
                  <GridVideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-surface-600" />
                <p className="text-surface-400">No results found</p>
              </div>
            )}
          </div>
        ) : rowsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <ScrollableRow key={row.id} row={row} />
          ))
        ) : (
          <div className="py-12 text-center">
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

// ── Scrollable Row ──────────────────────────────────────────────────

function ScrollableRow({ row }: { row: ContentRow }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videos = row.videos ?? [];
  if (videos.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-white">{row.title}</h2>
      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        >
          {videos.map((video) => (
            <RowVideoCard key={video.id} video={video} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function RowVideoCard({ video }: { video: Video }) {
  return (
    <Link
      to={`/videos/${video.slug}`}
      className="group/card w-[220px] shrink-0 sm:w-[260px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-surface-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover/card:bg-black/30" />
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {Math.floor(video.duration / 60)}:
            {String(video.duration % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium text-surface-200 group-hover/card:text-white">
        {video.title}
      </h3>
      {video.channel && (
        <p className="mt-0.5 text-xs text-surface-500">{video.channel.name}</p>
      )}
    </Link>
  );
}

function GridVideoCard({ video }: { video: Video }) {
  return (
    <Link
      to={`/videos/${video.slug}`}
      className="group/card"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-800">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-surface-600" />
          </div>
        )}
        {video.duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {Math.floor(video.duration / 60)}:
            {String(video.duration % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium text-surface-200 group-hover/card:text-white">
        {video.title}
      </h3>
      {video.channel && (
        <p className="mt-0.5 text-xs text-surface-500">{video.channel.name}</p>
      )}
    </Link>
  );
}
