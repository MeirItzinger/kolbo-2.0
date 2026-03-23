import { useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play, Tv } from "lucide-react";
import { getHomepageElements } from "@/api/landing";
import { resolveUploadedAssetUrl } from "@/api/client";
import { listChannels } from "@/api/channels";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatCurrency } from "@/lib/utils";
import type { HomepageElement, Video } from "@/types";

export default function HomePage() {
  const elementsQuery = useQuery({
    queryKey: ["landing", "homepage-elements"],
    queryFn: getHomepageElements,
  });

  const channelsQuery = useQuery({
    queryKey: ["landing", "channels"],
    queryFn: () => listChannels({ perPage: 12 }),
  });

  const elements: HomepageElement[] = (elementsQuery.data ?? []).filter(
    (el) => el.isActive,
  );
  const channels = channelsQuery.data?.data ?? [];

  if (elementsQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-surface-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="bg-surface-950">
        <DefaultHero />
      </div>
    );
  }

  return (
    <div className="bg-surface-950">
      {elements.map((el) => (
        <HomepageSection key={el.id} element={el} channels={channels} />
      ))}
    </div>
  );
}

function HomepageSection({
  element,
  channels,
}: {
  element: HomepageElement;
  channels: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string;
    subscriptionPlans?: { price: string | number }[];
  }[];
}) {
  switch (element.type) {
    case "HERO":
      return <HeroSection element={element} />;
    case "CONTENT_ROW":
      return <ContentRowSection element={element} />;
    case "CHANNEL_ROW":
      return <ChannelRowSection channels={channels} />;
    case "TEXT_DIVIDER":
      return <TextDividerSection element={element} />;
    case "LINE_DIVIDER":
      return <LineDividerSection />;
    default:
      return null;
  }
}

// ── Default Hero (when no elements exist) ────────────────────────

function DefaultHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/40 via-surface-950 to-surface-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8 lg:py-40">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          All your favorite channels.{" "}
          <span className="bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">
            One place.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-surface-300">
          Subscribe to the channels you love and stream thousands of videos on
          demand. No cable required.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/signup">
              Start Watching
              <Play className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/explore">Browse Channels</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Hero Section ─────────────────────────────────────────────────

function HeroSection({ element }: { element: HomepageElement }) {
  const linked =
    (element.items ?? [])
      .map((item) => item.video)
      .find((v): v is Video => !!v && !!v.slug) ?? null;

  /** CMS may store dev URLs; resolveUploadedAssetUrl rewrites localhost uploads to this deployment’s API origin. */
  const imgSrc = element.imageUrl
    ? resolveUploadedAssetUrl(element.imageUrl)
    : null;

  return (
    <section className="relative min-h-[420px] sm:min-h-[520px]">
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={element.title ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/40 via-surface-950 to-surface-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-transparent" />
      <div className="relative mx-auto flex max-w-7xl items-end px-4 pb-16 pt-32 sm:px-6 sm:pt-48 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold text-white sm:text-5xl">
            {element.title}
          </h1>
          {element.subtitle && (
            <p className="mt-4 text-lg text-surface-300">{element.subtitle}</p>
          )}
          {linked ? (
            <Button size="lg" className="mt-6 gap-2" asChild>
              <Link to={`/watch/${linked.slug}`}>
                Watch now
                <Play className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button size="lg" className="mt-6" asChild>
              <Link to="/signup">
                Start Watching
                <Play className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Content Row Section ──────────────────────────────────────────

function ContentRowSection({ element }: { element: HomepageElement }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videos: Video[] = (element.items ?? [])
    .map((item) => item.video)
    .filter((v): v is Video => !!v);

  if (videos.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="mb-4 text-lg font-semibold text-white">
        {element.title}
      </h2>
      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        >
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
        {videos.length > 3 && (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}

// ── Channel Row Section ──────────────────────────────────────────

function ChannelRowSection({
  channels,
}: {
  channels: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string;
    subscriptionPlans?: { price: string | number }[];
  }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (channels.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Popular Channels</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="rounded-full bg-surface-800/80 p-1.5 text-surface-300 hover:bg-surface-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="rounded-full bg-surface-800/80 p-1.5 text-surface-300 hover:bg-surface-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            to="/explore"
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            View all
          </Link>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
      >
        {channels.map((ch) => (
          <Link
            key={ch.id}
            to={`/channels/${ch.slug}`}
            className="group w-36 shrink-0 rounded-xl border border-surface-800 bg-surface-900 p-4 text-center transition-all hover:border-surface-600 sm:w-40"
          >
            {ch.logoUrl ? (
              <img
                src={ch.logoUrl}
                alt={ch.name}
                className="mx-auto mb-3 h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-surface-800">
                <Tv className="h-8 w-8 text-surface-500" />
              </div>
            )}
            <h3 className="truncate text-sm font-medium text-surface-200 group-hover:text-white">
              {ch.name}
            </h3>
            {ch.subscriptionPlans?.[0] && (
              <p className="mt-1 text-xs text-surface-500">
                from{" "}
                {formatCurrency(Number(ch.subscriptionPlans[0].price))}/mo
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Text Divider Section ─────────────────────────────────────────

function TextDividerSection({ element }: { element: HomepageElement }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">
        {element.text}
      </h2>
    </section>
  );
}

// ── Line Divider Section ─────────────────────────────────────────

function LineDividerSection() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <hr className="border-surface-800" />
    </div>
  );
}

// ── Video Card ───────────────────────────────────────────────────

function VideoCard({ video }: { video: Video }) {
  return (
    <Link
      to={`/videos/${video.slug}`}
      className="group/card w-[220px] shrink-0 sm:w-[260px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-800">
        {video.thumbnailAssets?.[0]?.imageUrl ? (
          <img
            src={video.thumbnailAssets[0].imageUrl}
            alt={video.title}
            className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-900/30 to-surface-800">
            <Play className="h-8 w-8 text-surface-600" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/card:bg-black/30">
          <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover/card:opacity-100" />
        </div>
        {video.durationSeconds && (
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {Math.floor(video.durationSeconds / 60)}:
            {String(video.durationSeconds % 60).padStart(2, "0")}
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
