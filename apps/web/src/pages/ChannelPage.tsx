import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { createCheckoutRental, createCheckoutPurchase } from "@/api/stripe";
import {
  Play,
  Tv,
  CheckCircle,
  Lock,
  Clock,
  LogIn,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { PrerollAd } from "@/features/player/PrerollAd";
import { getChannel, getChannelPageElements, getChannelCategories } from "@/api/channels";
import { listVideos, getVideo } from "@/api/videos";
import { api, resolveUploadedAssetUrl } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { formatCurrency } from "@/lib/utils";
import type { Video, SubscriptionPlan, PlanPriceVariant, HomepageElement, Category } from "@/types";

export default function ChannelPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;

    setSearchParams((prev) => {
      prev.delete("session_id");
      return prev;
    }, { replace: true });

    api.get(`/stripe/session/${sessionId}`)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["my-rentals"] });
        queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const channelQuery = useQuery({
    queryKey: ["channel", slug],
    queryFn: () => getChannel(slug!),
    enabled: !!slug,
  });

  const channel = channelQuery.data;

  const videosQuery = useQuery({
    queryKey: ["channel", channel?.id, "videos"],
    queryFn: () =>
      listVideos({
        channelId: channel!.id,
        status: "PUBLISHED",
        perPage: 50,
      }),
    enabled: !!channel?.id,
  });

  const videoDetailQuery = useQuery({
    queryKey: ["video-detail", selectedVideo?.slug],
    queryFn: () => {
      const res = getVideo(selectedVideo!.slug);
      return res;
    },
    enabled: !!selectedVideo?.slug && modalOpen,
  });

  const mySubsQuery = useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const { data } = await api.get("/account/subscriptions");
      return data.data ?? data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  const myRentalsQuery = useQuery({
    queryKey: ["my-rentals"],
    queryFn: async () => {
      const { data } = await api.get("/account/rentals");
      return data.data ?? data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });

  const myPurchasesQuery = useQuery({
    queryKey: ["my-purchases"],
    queryFn: async () => {
      const { data } = await api.get("/account/purchases");
      return data.data ?? data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });

  const hasChannelSub = (() => {
    if (!channel || !mySubsQuery.data) return false;
    const subs = mySubsQuery.data.channelSubscriptions ?? mySubsQuery.data ?? [];
    return subs.some(
      (s: any) => s.channelId === channel.id && (s.status === "ACTIVE" || s.status === "TRIALING"),
    );
  })();

  const pageElementsQuery = useQuery({
    queryKey: ["channel", channel?.id, "page-elements"],
    queryFn: () => getChannelPageElements(channel!.id),
    enabled: !!channel?.id,
  });

  const pageElements: HomepageElement[] = (() => {
    const d = pageElementsQuery.data;
    if (Array.isArray(d)) return d.filter((e: HomepageElement) => e.isActive);
    return [];
  })();

  const categoriesQuery = useQuery({
    queryKey: ["channel", channel?.id, "categories"],
    queryFn: () => getChannelCategories(channel!.id),
    enabled: !!channel?.id,
  });

  const channelCategories: Category[] = (() => {
    const d = categoriesQuery.data;
    if (Array.isArray(d)) return d.filter((c: Category) => c.isActive);
    return [];
  })();

  const rawVideos = videosQuery.data;
  const videos: Video[] = Array.isArray(rawVideos)
    ? rawVideos
    : rawVideos?.data ?? [];

  /** True if at least one video is linked to an active channel category (many-to-many). */
  type UnifiedPageItem =
    | { kind: "element"; sortOrder: number; data: HomepageElement }
    | { kind: "category"; sortOrder: number; data: Category };

  const unifiedPageItems: UnifiedPageItem[] = [
    ...pageElements.map((el): UnifiedPageItem => ({
      kind: "element",
      sortOrder: el.sortOrder ?? 0,
      data: el,
    })),
    ...channelCategories
      .filter((cat) =>
        videos.some((v) =>
          (v.categories ?? []).some((c) => c.id === cat.id),
        ),
      )
      .map((cat): UnifiedPageItem => ({
        kind: "category",
        sortOrder: cat.sortOrder ?? 0,
        data: cat,
      })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const uncategorizedVideos = videos.filter((v) => {
    const ids = (v.categories ?? []).map((c) => c.id);
    if (ids.length === 0) return true;
    return !ids.some((id) => channelCategories.some((c) => c.id === id));
  });

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video);
    setModalOpen(true);
  };

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (channelQuery.isError || !channel) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <Tv className="mb-4 h-12 w-12 text-surface-600" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Channel not found
        </h2>
        <p className="mb-6 text-surface-400">
          The channel you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link to="/explore">Browse Channels</Link>
        </Button>
      </div>
    );
  }

  const plans = (channel.subscriptionPlans ?? []).filter(
    (p: SubscriptionPlan) => p.isActive,
  );

  const videoDetail = videoDetailQuery.data;
  const detailData = videoDetail
    ? (videoDetail as any).data ?? videoDetail
    : null;

  const hasAccess = (() => {
    if (!detailData) return false;
    // Public playback (no subscription required)
    if (detailData.isFree || detailData.freeWithAds) return true;
    if (!isAuthenticated) return false;
    if (hasRole("SUPER_ADMIN")) return true;
    if (hasChannelSub) return true;

    const videoId = detailData.id;
    const rentals: any[] = myRentalsQuery.data ?? [];
    const hasActiveRental = rentals.some(
      (r: any) =>
        r.videoId === videoId &&
        r.status === "ACTIVE" &&
        new Date(r.accessEndsAt) > new Date(),
    );
    if (hasActiveRental) return true;

    const purchases: any[] = myPurchasesQuery.data ?? [];
    const hasActivePurchase = purchases.some(
      (p: any) => p.videoId === videoId && p.status === "ACTIVE",
    );
    if (hasActivePurchase) return true;

    return false;
  })();

  const playbackId =
    detailData?.videoAssets?.[0]?.muxPlaybackId ?? null;

  /** Full-bleed hero image: banner wins; else channel image covers same area as page-builder HERO. */
  const heroImageSrc = channel.bannerUrl
    ? resolveUploadedAssetUrl(channel.bannerUrl)
    : channel.logoUrl
      ? resolveUploadedAssetUrl(channel.logoUrl)
      : null;
  const logoFillsHero = !channel.bannerUrl && !!channel.logoUrl;
  const showOverlapThumbnail =
    !!channel.bannerUrl && !!channel.logoUrl;

  const channelHeaderBody = (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {channel.name}
        </h1>
        {channel.isActive && (
          <CheckCircle className="h-5 w-5 shrink-0 text-primary-400" />
        )}
        {!hasChannelSub && (
          <Button size="sm" className="shrink-0" asChild>
            <Link to={`/pricing/${slug}`}>Subscribe to channel</Link>
          </Button>
        )}
      </div>
      {channel.description && (
        <p className="mt-2 max-w-2xl text-surface-300 sm:text-surface-400">
          {channel.description}
        </p>
      )}
      {videos.length > 0 && (
        <p className="mt-1 text-sm text-surface-400 sm:text-surface-500">
          {videos.length} video{videos.length !== 1 ? "s" : ""}
        </p>
      )}
    </>
  );

  return (
    <div className="bg-surface-950">
      {/* Banner / hero — same height as page-builder HERO */}
      <div className="relative h-48 sm:h-64 lg:h-80 overflow-hidden">
        {heroImageSrc ? (
          <img
            src={heroImageSrc}
            alt={channel.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-900/30 via-surface-900 to-surface-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent" />
        {logoFillsHero && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{channelHeaderBody}</div>
          </div>
        )}
      </div>

      {/* Overlap row: small logo only when banner + separate logo; otherwise full hero already shows the image */}
      {!logoFillsHero && (
        <div className="relative mx-auto -mt-16 max-w-7xl px-4 sm:-mt-20 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
            {showOverlapThumbnail ? (
              <img
                src={resolveUploadedAssetUrl(channel.logoUrl!)}
                alt={channel.name}
                className="h-24 w-24 rounded-2xl border-4 border-surface-950 object-cover shadow-xl sm:h-32 sm:w-32"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-surface-950 bg-surface-800 shadow-xl sm:h-32 sm:w-32">
                <Tv className="h-10 w-10 text-surface-500" />
              </div>
            )}
            <div className="flex-1 pb-2">{channelHeaderBody}</div>
          </div>
        </div>
      )}

      {/* Unified channel content: page builder elements + category rows in sort order */}
      {videosQuery.isLoading ? (
        <section className="mx-auto mt-10 max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        </section>
      ) : unifiedPageItems.length === 0 && videos.length === 0 ? (
        <section className="mx-auto mt-10 max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="py-16 text-center">
            <Play className="mx-auto mb-3 h-10 w-10 text-surface-600" />
            <p className="text-surface-500">No videos available yet.</p>
          </div>
        </section>
      ) : unifiedPageItems.length > 0 ? (
        <div className="mt-10 pb-16">
          {unifiedPageItems.map((item) =>
            item.kind === "element" ? (
              <ChannelSection
                key={item.data.id}
                element={item.data}
                onVideoClick={handleVideoClick}
              />
            ) : (
              <section
                key={item.data.id}
                className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
              >
                <CategoryRow
                  category={item.data}
                  videos={videos.filter((v) =>
                    (v.categories ?? []).some((c) => c.id === item.data.id),
                  )}
                  onVideoClick={handleVideoClick}
                />
              </section>
            ),
          )}
          {uncategorizedVideos.length > 0 && (
            <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <CategoryRow
                category={{ id: "_uncategorized", name: "More Videos", slug: "more", channelId: "", sortOrder: 999, isActive: true, createdAt: "", updatedAt: "" }}
                videos={uncategorizedVideos}
                onVideoClick={handleVideoClick}
              />
            </section>
          )}
        </div>
      ) : videos.length > 0 ? (
        <section className="mx-auto mt-10 max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Videos</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onClick={() => handleVideoClick(v)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Video modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className={
            hasAccess && playbackId
              ? "max-w-4xl p-0 overflow-hidden"
              : "max-w-md"
          }
        >
          {videoDetailQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : !detailData ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : !isAuthenticated &&
            !detailData.isFree &&
            !detailData.freeWithAds ? (
            <AuthPrompt videoTitle={detailData.title ?? "this video"} />
          ) : hasAccess && playbackId ? (
            <ChannelModalPlayer
              videoId={detailData.id}
              playbackId={playbackId}
              title={detailData.title ?? ""}
            />
          ) : hasAccess && !playbackId ? (
            <VideoProcessing title={detailData?.title ?? "this video"} />
          ) : (
            <PaywallPrompt
              video={detailData}
              channelSlug={slug!}
              plans={plans}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Category Row ──────────────────────────────────────────────────

function CategoryRow({
  category,
  videos,
  onVideoClick,
}: {
  category: Category;
  videos: Video[];
  onVideoClick: (video: Video) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", checkScroll);
    return () => { el?.removeEventListener("scroll", checkScroll); };
  }, [checkScroll, videos]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{category.name}</h3>
        <div className="flex gap-1">
          {canScrollLeft && (
            <button
              onClick={() => scroll("left")}
              className="rounded-full bg-surface-800/80 p-1.5 text-surface-300 hover:bg-surface-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll("right")}
              className="rounded-full bg-surface-800/80 p-1.5 text-surface-300 hover:bg-surface-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
      >
        {videos.map((v) => (
          <div key={v.id} className="w-48 flex-shrink-0 sm:w-52">
            <VideoCard video={v} onClick={() => onVideoClick(v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Channel Page Builder Sections ──────────────────────────────────

function ChannelSection({
  element,
  onVideoClick,
}: {
  element: HomepageElement;
  onVideoClick: (video: Video) => void;
}) {
  switch (element.type) {
    case "HERO":
      return <ChannelHeroSection element={element} />;
    case "CONTENT_ROW":
      return <ChannelContentRowSection element={element} onVideoClick={onVideoClick} />;
    case "TEXT_DIVIDER":
      return <ChannelTextDividerSection element={element} />;
    case "LINE_DIVIDER":
      return <ChannelLineDividerSection />;
    default:
      return null;
  }
}

function ChannelHeroSection({ element }: { element: HomepageElement }) {
  return (
    <div className="relative h-48 sm:h-64 lg:h-80 overflow-hidden">
      {element.imageUrl ? (
        <img
          src={element.imageUrl}
          alt={element.title ?? ""}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary-900/30 via-surface-900 to-surface-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            {element.title}
          </h2>
          {element.subtitle && (
            <p className="mt-2 max-w-2xl text-surface-300">{element.subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelContentRowSection({
  element,
  onVideoClick,
}: {
  element: HomepageElement;
  onVideoClick: (video: Video) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videos = (element.items ?? [])
    .map((item) => item.video)
    .filter((v): v is Video => !!v);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  if (videos.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="mb-4 text-lg font-semibold text-white">{element.title}</h2>
      <div className="group/scroll relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        >
          {videos.map((v) => (
            <div key={v.id} className="w-[200px] shrink-0 sm:w-[240px]">
              <VideoCard video={v} onClick={() => onVideoClick(v)} />
            </div>
          ))}
        </div>
        {videos.length > 4 && (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/3 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition-opacity group-hover/scroll:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/3 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition-opacity group-hover/scroll:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function ChannelTextDividerSection({ element }: { element: HomepageElement }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-center">
      <p className="text-xl font-semibold text-white">{element.text}</p>
    </div>
  );
}

function ChannelLineDividerSection() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <hr className="border-surface-800 my-4" />
    </div>
  );
}

// ── Video Card ─────────────────────────────────────────────────────

function VideoCard({
  video,
  onClick,
}: {
  video: Video;
  onClick: () => void;
}) {
  const thumbnail =
    (video as any).thumbnailUrl ??
    video.thumbnailAssets?.[0]?.imageUrl ??
    null;

  const duration =
    (video as any).duration ??
    video.durationSeconds ??
    video.videoAssets?.[0]?.durationSeconds ??
    null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/card w-full text-left"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-800">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-surface-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/card:bg-black/40">
          <Play className="h-10 w-10 text-white opacity-0 drop-shadow-lg transition-opacity group-hover/card:opacity-100" />
        </div>
        {duration && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            <Clock className="h-3 w-3" />
            {Math.floor(duration / 60)}:
            {String(Math.round(duration % 60)).padStart(2, "0")}
          </span>
        )}
        {video.isFree && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-green-600/90 text-white"
          >
            Free
          </Badge>
        )}
        {!video.isFree && (
          <Lock className="absolute right-2 top-2 h-4 w-4 text-surface-400 opacity-70" />
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-medium text-surface-200 group-hover/card:text-white">
        {video.title}
      </h3>
      {video.creatorProfile?.displayName && (
        <p className="mt-0.5 text-xs text-surface-500">
          {video.creatorProfile.displayName}
        </p>
      )}
    </button>
  );
}

// ── Auth Prompt (not logged in) ────────────────────────────────────

function AuthPrompt({ videoTitle }: { videoTitle: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Sign in to watch</DialogTitle>
        <DialogDescription>
          Log in or create an account to watch &ldquo;{videoTitle}&rdquo; and
          access exclusive content.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 flex flex-col gap-3">
        <Button asChild size="lg">
          <Link to="/login">
            <LogIn className="mr-2 h-4 w-4" />
            Log In
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/signup">
            <UserPlus className="mr-2 h-4 w-4" />
            Create Account
          </Link>
        </Button>
      </div>
    </>
  );
}

// ── Channel modal playback (token + optional preroll for any ad-eligible access) ──

const PLAYBACK_API_BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchPlaybackTokenForModal(videoId: string) {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const { data } = await axios.get(
    `${PLAYBACK_API_BASE}/playback/token/${videoId}`,
    { headers },
  );
  return data?.data ?? data;
}

async function fetchPrerollAdForModal(videoId: string) {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const { data } = await axios.get(
    `${PLAYBACK_API_BASE}/playback/ad/${videoId}`,
    { headers },
  );
  return data?.data ?? null;
}

function ChannelModalPlayer({
  videoId,
  playbackId: fallbackPlaybackId,
  title,
}: {
  videoId: string;
  playbackId: string;
  title: string;
}) {
  const [showingAd, setShowingAd] = useState(true);
  const sessionEndedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    setShowingAd(true);
    sessionEndedRef.current = false;
  }, [videoId]);

  const tokenQuery = useQuery({
    queryKey: ["playback-token", "modal", videoId],
    queryFn: () => fetchPlaybackTokenForModal(videoId),
  });

  const adNonce = useRef(0);
  useEffect(() => { adNonce.current++; }, [videoId]);

  const adQuery = useQuery({
    queryKey: ["preroll-ad", "modal", videoId, adNonce.current],
    queryFn: () => fetchPrerollAdForModal(videoId),
    enabled:
      tokenQuery.isSuccess &&
      tokenQuery.data?.adMode !== "none",
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    const hasAd = !!adQuery.data?.playbackId;
    if (adQuery.isFetched && !hasAd && tokenQuery.isSuccess) setShowingAd(false);
    if (tokenQuery.isSuccess && tokenQuery.data?.adMode === "none") setShowingAd(false);
  }, [adQuery.data, adQuery.isFetched, tokenQuery.isSuccess, tokenQuery.data?.adMode]);

  const handleAdComplete = useCallback(() => setShowingAd(false), []);

  const handleHeartbeat = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) {
      api.post("/watch-sessions/heartbeat", { sessionId: sid }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    sessionIdRef.current = tokenQuery.data?.sessionId ?? null;
  }, [tokenQuery.data?.sessionId]);

  const handleEnd = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      api.post("/watch-sessions/end", { sessionId: sid }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (sid && !sessionEndedRef.current) {
        sessionEndedRef.current = true;
        api.post("/watch-sessions/end", { sessionId: sid }).catch(() => {});
      }
    };
  }, []);

  if (tokenQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (tokenQuery.isError) {
    return (
      <div className="p-6 text-center text-sm text-destructive">
        Could not start playback. Try again or open the full watch page.
      </div>
    );
  }

  const resolvedPlaybackId =
    tokenQuery.data?.playbackId ?? fallbackPlaybackId;
  const muxToken = tokenQuery.data?.token ?? undefined;

  return (
    <div>
      {showingAd &&
      adQuery.data?.playbackId &&
      adQuery.data?.creativeId ? (
        <div style={{ aspectRatio: "16/9", width: "100%" }}>
          <PrerollAd
            playbackId={adQuery.data.playbackId}
            advertiser={adQuery.data.advertiser}
            billing={{
              videoId,
              campaignId: adQuery.data.campaignId,
              creativeId: adQuery.data.creativeId,
            }}
            onComplete={handleAdComplete}
          />
        </div>
      ) : (
        <div className="aspect-video w-full">
          <VideoPlayer
            playbackId={resolvedPlaybackId}
            token={muxToken}
            title={title}
            onHeartbeat={handleHeartbeat}
            onEnd={handleEnd}
            className="h-full w-full"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
    </div>
  );
}

// ── Video Processing (has access but video not ready) ───────────────

function VideoProcessing({ title }: { title: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          This video is still being processed. Please check back shortly.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <Spinner />
        <p className="text-sm text-surface-400">Video processing&hellip;</p>
      </div>
    </>
  );
}

// ── Paywall Prompt (logged in but no access) ───────────────────────

function PaywallPrompt({
  video,
  channelSlug,
  plans,
}: {
  video: any;
  channelSlug: string;
  plans: SubscriptionPlan[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRent = useCallback(async (rentalOptionId: string) => {
    setLoadingId(rentalOptionId);
    try {
      const { url } = await createCheckoutRental({
        rentalOptionId,
        successUrl: `${window.location.origin}/channels/${channelSlug}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to start checkout");
    } finally {
      setLoadingId(null);
    }
  }, [channelSlug]);

  const handlePurchase = useCallback(async (purchaseOptionId: string) => {
    setLoadingId(purchaseOptionId);
    try {
      const { url } = await createCheckoutPurchase({
        purchaseOptionId,
        successUrl: `${window.location.origin}/channels/${channelSlug}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.href,
      });
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to start checkout");
    } finally {
      setLoadingId(null);
    }
  }, [channelSlug]);

  const planRows = plans.flatMap((plan) =>
    (plan.priceVariants ?? [])
      .filter((v) => v.isActive)
      .map((v) => ({ plan, variant: v })),
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <Lock className="mr-2 inline h-5 w-5 text-surface-400" />
          Unlock &ldquo;{video?.title ?? "this video"}&rdquo;
        </DialogTitle>
        <DialogDescription>
          This content requires a subscription. Choose a plan to start watching.
        </DialogDescription>
      </DialogHeader>

      {planRows.length > 0 && (
        <div className="mt-2 space-y-3">
          {planRows.map(({ plan, variant }) => {
            const price = Number(variant.price);
            const interval =
              variant.billingInterval === "YEARLY" ? "year" : "mo";
            const streams = variant.concurrencyTier.replace("STREAMS_", "");
            return (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 p-3"
              >
                <div>
                  <p className="font-medium text-white">{plan.name}</p>
                  <p className="text-sm text-surface-400">
                    {formatCurrency(price)}/{interval} · {streams} stream{streams !== "1" ? "s" : ""}
                    {variant.adTier === "WITH_ADS" ? " · ads" : ""}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link
                    to={`/pricing/${channelSlug}?variant=${encodeURIComponent(variant.id)}`}
                  >
                    Subscribe
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {video?.rentalOptions?.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-surface-300">
            Or rent this video:
          </p>
          {video.rentalOptions.map((r: any) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 p-3"
            >
              <div>
                <p className="font-medium text-white">{r.name}</p>
                <p className="text-sm text-surface-400">
                  {formatCurrency(Number(r.price))} &middot; {r.rentalHours}h
                  access
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={loadingId === r.id}
                onClick={() => handleRent(r.id)}
              >
                {loadingId === r.id ? <Spinner size="sm" /> : "Rent"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {video?.purchaseOptions?.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-surface-300">
            Or buy to own:
          </p>
          {video.purchaseOptions.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-surface-700 bg-surface-800 p-3"
            >
              <div>
                <p className="font-medium text-white">{p.name}</p>
                <p className="text-sm text-surface-400">
                  {formatCurrency(Number(p.price))}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={loadingId === p.id}
                onClick={() => handlePurchase(p.id)}
              >
                {loadingId === p.id ? <Spinner size="sm" /> : "Buy"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

