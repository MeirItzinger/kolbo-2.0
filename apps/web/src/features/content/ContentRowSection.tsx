import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoCard } from "./VideoCard";
import type { ContentRow } from "@/types";

interface ContentRowSectionProps {
  row: ContentRow;
  seeAllLink?: string;
}

export function ContentRowSection({ row, seeAllLink }: ContentRowSectionProps) {
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
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{row.title}</h2>
        {seeAllLink && (
          <Link
            to={seeAllLink}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            See All
          </Link>
        )}
      </div>
      <div className="group relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
        >
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
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
