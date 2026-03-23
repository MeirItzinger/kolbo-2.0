import { useEffect, useRef, useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getVideo } from "@/api/videos";
import { api } from "@/api/client";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { PrerollAd } from "@/features/player/PrerollAd";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import axios from "axios";

interface PlaybackData {
  playbackId: string;
  token: string | null;
  sessionId: string | null;
  accessType: string | null;
  adMode: string;
}

interface AdData {
  creativeId: string;
  playbackId: string;
  campaignId: string;
  advertiser: string;
  durationSeconds: number | null;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function getPlaybackToken(videoId: string): Promise<PlaybackData> {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const { data } = await axios.get(`${API_BASE}/playback/token/${videoId}`, { headers });
  return data?.data ?? data;
}

async function getPrerollAd(videoId: string): Promise<AdData | null> {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const { data } = await axios.get(`${API_BASE}/playback/ad/${videoId}`, {
    headers,
  });
  return data?.data ?? null;
}

async function sendHeartbeat(sessionId: string): Promise<void> {
  await api.post("/watch-sessions/heartbeat", { sessionId });
}

async function endSession(sessionId: string): Promise<void> {
  await api.post("/watch-sessions/end", { sessionId });
}

let adRequestCounter = 0;

export default function WatchPage() {
  const { slug } = useParams<{ slug: string }>();
  const sessionEndedRef = useRef(false);
  const [showingAd, setShowingAd] = useState(true);
  const adNonce = useRef(++adRequestCounter);

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

  const adQuery = useQuery({
    queryKey: ["preroll-ad", video?.id, adNonce.current],
    queryFn: () => getPrerollAd(video!.id),
    enabled: !!video?.id && tokenQuery.data?.adMode !== "none",
    staleTime: 0,
    gcTime: 0,
  });

  const hasAd = !!adQuery.data?.playbackId;
  const sessionId = tokenQuery.data?.sessionId ?? null;

  useEffect(() => {
    if (adQuery.isFetched && !hasAd && tokenQuery.isSuccess) {
      setShowingAd(false);
    }
  }, [hasAd, tokenQuery.isSuccess, adQuery.isFetched]);

  const handleAdComplete = useCallback(() => {
    setShowingAd(false);
  }, []);

  const handleHeartbeat = useCallback(() => {
    if (sessionId) sendHeartbeat(sessionId).catch(() => {});
  }, [sessionId]);

  const handleEnd = useCallback(() => {
    if (sessionId && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      endSession(sessionId).catch(() => {});
    }
  }, [sessionId]);

  useEffect(() => {
    const sid = sessionId;
    return () => {
      if (sid && !sessionEndedRef.current) {
        sessionEndedRef.current = true;
        endSession(sid).catch(() => {});
      }
    };
  }, [sessionId]);

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

  if (tokenQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Access denied
        </h2>
        <p className="mb-6 text-surface-400">
          You don&apos;t have access to this video.
        </p>
        <Button asChild>
          <Link to={`/videos/${video.slug}`}>Back to Details</Link>
        </Button>
      </div>
    );
  }

  const playbackId = tokenQuery.data?.playbackId ?? video.videoAssets?.[0]?.muxPlaybackId;

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
      {showingAd &&
      adQuery.data?.playbackId &&
      adQuery.data?.creativeId ? (
        <PrerollAd
          playbackId={adQuery.data.playbackId}
          advertiser={adQuery.data.advertiser}
          billing={{
            videoId: video.id,
            campaignId: adQuery.data.campaignId,
            creativeId: adQuery.data.creativeId,
          }}
          onComplete={handleAdComplete}
        />
      ) : (
        <VideoPlayer
          playbackId={playbackId}
          token={tokenQuery.data?.token ?? undefined}
          title={video.title}
          onHeartbeat={handleHeartbeat}
          onEnd={handleEnd}
          className="h-full w-full"
        />
      )}

      {/* Title overlay (only when showing actual content) */}
      {!showingAd && (
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
      )}
    </div>
  );
}
