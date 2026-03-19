import { useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getVideo } from "@/api/videos";
import { api } from "@/api/client";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

async function getPlaybackToken(videoId: string): Promise<{ token: string }> {
  const { data } = await api.get(`/videos/${videoId}/playback-token`);
  return data;
}

async function sendHeartbeat(videoId: string): Promise<void> {
  await api.post(`/videos/${videoId}/heartbeat`);
}

async function endSession(videoId: string): Promise<void> {
  await api.post(`/videos/${videoId}/end-session`);
}

export default function WatchPage() {
  const { slug } = useParams<{ slug: string }>();
  const sessionEndedRef = useRef(false);

  const videoQuery = useQuery({
    queryKey: ["video", slug],
    queryFn: () => getVideo(slug!),
    enabled: !!slug,
  });

  const video = videoQuery.data;

  const tokenQuery = useQuery({
    queryKey: ["playback-token", video?.id],
    queryFn: () => getPlaybackToken(video!.id),
    enabled: !!video?.id,
  });

  const handleHeartbeat = useCallback(() => {
    if (video?.id) sendHeartbeat(video.id).catch(() => {});
  }, [video?.id]);

  const handleEnd = useCallback(() => {
    if (video?.id && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      endSession(video.id).catch(() => {});
    }
  }, [video?.id]);

  useEffect(() => {
    const videoId = video?.id;
    return () => {
      if (videoId && !sessionEndedRef.current) {
        sessionEndedRef.current = true;
        endSession(videoId).catch(() => {});
      }
    };
  }, [video?.id]);

  if (videoQuery.isLoading || tokenQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (videoQuery.isError || !video) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Video not found
        </h2>
        <p className="mb-6 text-surface-400">
          This video doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const playbackId = video.asset?.muxPlaybackId;

  if (!playbackId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <AlertTriangle className="mb-4 h-12 w-12 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Video not ready
        </h2>
        <p className="mb-6 text-surface-400">
          This video is still being processed. Please try again later.
        </p>
        <Button asChild>
          <Link to={`/videos/${video.slug}`}>Back to Details</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black">
      <VideoPlayer
        playbackId={playbackId}
        token={tokenQuery.data?.token}
        title={video.title}
        onHeartbeat={handleHeartbeat}
        onEnd={handleEnd}
        className="h-full w-full"
      />

      {/* Title overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 sm:p-6">
        <div className="pointer-events-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/videos/${video.slug}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="truncate text-lg font-semibold text-white">
            {video.title}
          </h1>
        </div>
      </div>
    </div>
  );
}
