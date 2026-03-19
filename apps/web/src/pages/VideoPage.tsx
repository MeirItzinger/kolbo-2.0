import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Clock,
  Calendar,
  Tv,
  Lock,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Film,
} from "lucide-react";
import { getVideo } from "@/api/videos";
import { listVideos } from "@/api/videos";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Video } from "@/types";

export default function VideoPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();

  const videoQuery = useQuery({
    queryKey: ["video", slug],
    queryFn: () => getVideo(slug!),
    enabled: !!slug,
  });

  const video = videoQuery.data;

  const relatedQuery = useQuery({
    queryKey: ["video", slug, "related"],
    queryFn: () =>
      listVideos({ channelId: video!.channelId, perPage: 12 }),
    enabled: !!video?.channelId,
  });

  const relatedVideos = (relatedQuery.data?.data ?? []).filter(
    (v) => v.id !== video?.id,
  );

  if (videoQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (videoQuery.isError || !video) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <Film className="mb-4 h-12 w-12 text-surface-600" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Video not found
        </h2>
        <p className="mb-6 text-surface-400">
          This video doesn&apos;t exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/explore">Browse Content</Link>
        </Button>
      </div>
    );
  }

  const hasPlaybackAccess = video.isFree || isAuthenticated;
  const canPlay = video.asset?.muxPlaybackId && hasPlaybackAccess;

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="bg-surface-950">
      {/* Hero poster area */}
      <div className="relative">
        <div className="aspect-[21/9] max-h-[500px] w-full bg-surface-900">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-900/20 via-surface-900 to-surface-950">
              <Play className="h-20 w-20 text-surface-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/60 to-transparent" />
        </div>

        {/* Overlay content */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              {/* Badges */}
              <div className="mb-3 flex flex-wrap gap-2">
                {video.isFree && <Badge>Free</Badge>}
                {video.channel && (
                  <Badge variant="secondary">
                    <Tv className="mr-1 h-3 w-3" />
                    {video.channel.name}
                  </Badge>
                )}
                {video.status === "ready" && (
                  <Badge variant="success">Available</Badge>
                )}
              </div>

              <h1 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                {video.title}
              </h1>

              {/* Metadata */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-surface-400">
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDuration(video.duration)}
                  </span>
                )}
                {video.publishedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(video.publishedAt)}
                  </span>
                )}
                {video.creatorProfile && (
                  <span>By {video.creatorProfile.name}</span>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex flex-wrap gap-3">
                {canPlay ? (
                  <Button size="lg" asChild>
                    <Link to={`/watch/${video.slug}`}>
                      <Play className="h-5 w-5" />
                      Play
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled>
                    <Lock className="h-5 w-5" />
                    Subscribe to Watch
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Description */}
            {video.description && (
              <div className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-white">
                  About
                </h2>
                <p className="whitespace-pre-line text-surface-300 leading-relaxed">
                  {video.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {video.tags.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-3 text-sm font-semibold text-surface-300">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - access options */}
          <div className="space-y-4">
            {!video.isFree && !isAuthenticated && (
              <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
                <h3 className="mb-3 font-semibold text-white">
                  Get Access
                </h3>
                <p className="mb-4 text-sm text-surface-400">
                  Subscribe to {video.channel?.name ?? "this channel"} to watch
                  this and more.
                </p>
                <Button className="w-full" asChild>
                  <Link
                    to={
                      video.channel
                        ? `/channels/${video.channel.slug}`
                        : "/signup"
                    }
                  >
                    View Plans
                  </Link>
                </Button>
              </div>
            )}

            {video.rentalOption && (
              <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Rent</h3>
                    <p className="text-sm text-surface-400">
                      {video.rentalOption.durationHours}h access
                    </p>
                  </div>
                  <span className="text-lg font-bold text-white">
                    {formatCurrency(video.rentalOption.price)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  asChild={isAuthenticated}
                >
                  {isAuthenticated ? (
                    <Link to={`/checkout/rental/${video.id}`}>
                      <ShoppingCart className="h-4 w-4" />
                      Rent Now
                    </Link>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Sign in to Rent
                    </>
                  )}
                </Button>
              </div>
            )}

            {video.purchaseOption && (
              <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">Purchase</h3>
                    <p className="text-sm text-surface-400">Own forever</p>
                  </div>
                  <span className="text-lg font-bold text-white">
                    {formatCurrency(video.purchaseOption.price)}
                  </span>
                </div>
                <Button
                  className="mt-3 w-full"
                  asChild={isAuthenticated}
                >
                  {isAuthenticated ? (
                    <Link to={`/checkout/purchase/${video.id}`}>
                      <ShoppingCart className="h-4 w-4" />
                      Buy Now
                    </Link>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Sign in to Buy
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Channel card */}
            {video.channel && (
              <Link
                to={`/channels/${video.channel.slug}`}
                className="block rounded-xl border border-surface-800 bg-surface-900 p-5 transition-colors hover:border-surface-600"
              >
                <div className="flex items-center gap-3">
                  {video.channel.logoUrl ? (
                    <img
                      src={video.channel.logoUrl}
                      alt={video.channel.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-800">
                      <Tv className="h-6 w-6 text-surface-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-white">
                      {video.channel.name}
                    </p>
                    <p className="text-sm text-primary-400">View channel</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Related content */}
        {relatedVideos.length > 0 && (
          <RelatedSection videos={relatedVideos} />
        )}
      </div>
    </div>
  );
}

// ── Related Section ─────────────────────────────────────────────────

function RelatedSection({ videos }: { videos: Video[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section className="mt-12 border-t border-surface-800 pt-8">
      <h2 className="mb-4 text-lg font-semibold text-white">
        More Like This
      </h2>
      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        >
          {videos.map((video) => (
            <Link
              key={video.id}
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
            </Link>
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
