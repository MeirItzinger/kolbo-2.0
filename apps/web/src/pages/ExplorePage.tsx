import { useState, useMemo, useRef, useEffect } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Play, Search as SearchIcon, Tv, X, Lock, Compass, LayoutGrid } from "lucide-react";
import { listChannels } from "@/api/channels";
import { listVideos } from "@/api/videos";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { Video } from "@/types";

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const channelFilter = searchParams.get("channel") ?? "";
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (location.pathname === "/search") {
      searchInputRef.current?.focus();
    }
  }, [location.pathname]);

  const channelsQuery = useQuery({
    queryKey: ["explore", "channels"],
    queryFn: () => listChannels({ perPage: 50 }),
  });

  const videosQuery = useInfiniteQuery({
    queryKey: ["explore", "videos", channelFilter, searchTerm],
    queryFn: ({ pageParam }) =>
      listVideos({
        perPage: 48,
        page: pageParam,
        ...(channelFilter ? { channelId: channelFilter } : {}),
        ...(searchTerm.length >= 2 ? { search: searchTerm } : {}),
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage.meta;
      return page * limit < total ? page + 1 : undefined;
    },
    enabled: searchTerm.length === 0 || searchTerm.length >= 2,
  });

  const channels = channelsQuery.data?.data ?? [];
  /** Dedupe by id: offset pagination + changing sort keys can surface the same row on multiple pages. */
  const videos = useMemo(() => {
    const seen = new Set<string>();
    const out: Video[] = [];
    for (const page of videosQuery.data?.pages ?? []) {
      for (const v of page.data) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          out.push(v);
        }
      }
    }
    return out;
  }, [videosQuery.data?.pages]);
  const activeChannel = channels.find((c) => c.id === channelFilter);

  const setChannel = (id: string) => {
    setSearchTerm("");
    if (id) setSearchParams({ channel: id });
    else setSearchParams({});
  };

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
              Catalogue
            </h1>
          </div>
          <p className="mb-6 ml-[42px] text-sm text-surface-400">
            {activeChannel
              ? `Browsing: ${activeChannel.name}`
              : "Browse all videos by channel"}
          </p>

          {/* Search */}
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-500" />
            <Input
              ref={searchInputRef}
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">
        {/* Channel cards */}
        {channels.length > 0 && !searchTerm && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-surface-500">
              <LayoutGrid className="h-4 w-4" />
              Channels
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {/* "All" card */}
              <button
                type="button"
                onClick={() => setChannel("")}
                className={cn(
                  "group flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 text-center transition-all",
                  !channelFilter
                    ? "border-primary-500/60 bg-primary-600/15 ring-1 ring-primary-500/40"
                    : "border-surface-800 bg-surface-900 hover:border-surface-600 hover:bg-surface-800",
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-700">
                  <Tv className="h-7 w-7 text-surface-400" />
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    !channelFilter ? "text-primary-300" : "text-surface-200 group-hover:text-white",
                  )}
                >
                  All
                </span>
              </button>

              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannel(ch.id)}
                  className={cn(
                    "group flex flex-col items-center justify-center gap-3 rounded-2xl border p-5 text-center transition-all",
                    channelFilter === ch.id
                      ? "border-primary-500/60 bg-primary-600/15 ring-1 ring-primary-500/40"
                      : "border-surface-800 bg-surface-900 hover:border-surface-600 hover:bg-surface-800",
                  )}
                >
                  {ch.logoUrl ? (
                    <img
                      src={ch.logoUrl}
                      alt={ch.name}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-700">
                      <Tv className="h-7 w-7 text-surface-400" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "line-clamp-2 text-sm font-semibold leading-snug",
                      channelFilter === ch.id
                        ? "text-primary-300"
                        : "text-surface-200 group-hover:text-white",
                    )}
                  >
                    {ch.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Video grid */}
        <section>
          {(channelFilter || searchTerm.length >= 2) && (
            <h2 className="mb-5 text-xl font-semibold text-white">
              {searchTerm.length >= 2
                ? `Results for "${searchTerm}"`
                : activeChannel?.name ?? "All Videos"}
            </h2>
          )}

          {videosQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : videos.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
              {videosQuery.hasNextPage && (
                <div className="flex justify-center pt-10">
                  <Button
                    variant="outline"
                    onClick={() => videosQuery.fetchNextPage()}
                    disabled={videosQuery.isFetchingNextPage}
                  >
                    {videosQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-800">
                {searchTerm ? (
                  <SearchIcon className="h-7 w-7 text-surface-500" />
                ) : (
                  <Tv className="h-7 w-7 text-surface-500" />
                )}
              </div>
              <p className="font-medium text-surface-300">
                {searchTerm ? "No results found" : "No videos in this channel yet"}
              </p>
              {searchTerm ? (
                <p className="mt-1 text-sm text-surface-500">Try a different search term</p>
              ) : (
                <Button variant="outline" className="mt-6" onClick={() => setChannel("")}>
                  View all channels
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/40">
          <div className="flex h-12 w-12 scale-75 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
        {duration && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatDuration(duration)}
          </span>
        )}
        {video.isFree && (
          <span className="absolute left-2 top-2">
            <Badge className="text-[10px]">Free</Badge>
          </span>
        )}
      </div>
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
