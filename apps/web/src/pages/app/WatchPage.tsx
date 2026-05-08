import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, Lock, Clock, Moon } from "lucide-react";
import { getVideo } from "@/api/videos";
import { api, getUscreenAccessToken } from "@/api/client";
import { VideoPlayer } from "@/features/player/VideoPlayer";
import { PrerollAd } from "@/features/player/PrerollAd";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useMaturityFilter } from "@/hooks/useMaturityFilter";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useWatchTimeLimit } from "@/hooks/useWatchTimeLimit";
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

async function getPlaybackToken(
  videoId: string,
  profileId?: string | null,
): Promise<PlaybackData> {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const uscreenToken = getUscreenAccessToken();
  if (uscreenToken) headers["X-Uscreen-Access-Token"] = uscreenToken;
  const params = profileId ? { profileId } : undefined;
  const { data } = await axios.get(`${API_BASE}/playback/token/${videoId}`, {
    headers,
    params,
  });
  return data?.data ?? data;
}

async function getPrerollAd(
  videoId: string,
  profileId?: string | null,
): Promise<AdData | null> {
  const token = localStorage.getItem("kolbo_access_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const uscreenToken = getUscreenAccessToken();
  if (uscreenToken) headers["X-Uscreen-Access-Token"] = uscreenToken;
  const params = profileId ? { profileId } : undefined;
  const { data } = await axios.get(`${API_BASE}/playback/ad/${videoId}`, {
    headers,
    params,
  });
  return data?.data ?? null;
}

interface ParentalServerBlock {
  reason: "OUTSIDE_HOURS" | "MATURITY" | "TIME_LIMIT";
  message: string;
  details?: Record<string, unknown>;
}

async function sendHeartbeat(sessionId: string): Promise<void> {
  await api.post("/watch-sessions/heartbeat", { sessionId });
}

async function endSession(sessionId: string): Promise<void> {
  await api.post("/watch-sessions/end", { sessionId });
}

let adRequestCounter = 0;

function formatHour(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const hh = String(Math.floor(h) % 24).padStart(2, "0");
  return `${hh}:00`;
}

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
  const { isAllowed: isMaturityAllowed, activeRatingCap } = useMaturityFilter();
  const blockedByMaturity = !!video && !isMaturityAllowed(video as any);

  const { activeProfile, parentalControls } = useActiveProfile();
  const watchTime = useWatchTimeLimit(activeProfile?.id, parentalControls);
  const [heartbeatBlock, setHeartbeatBlock] = useState<ParentalServerBlock | null>(
    null,
  );
  useEffect(() => {
    setHeartbeatBlock(null);
  }, [activeProfile?.id, video?.id]);

  const tokenQuery = useQuery({
    queryKey: ["playback-token", video?.id, activeProfile?.id],
    queryFn: () => getPlaybackToken(video!.id, activeProfile?.id),
    enabled: !!video?.id,
    retry: (failureCount, err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) return false;
      return failureCount < 2;
    },
  });

  const tokenParentalBlock = useMemo<ParentalServerBlock | null>(() => {
    const err = tokenQuery.error;
    if (
      axios.isAxiosError(err) &&
      err.response?.status === 403 &&
      err.response.data?.code === "PARENTAL_BLOCKED"
    ) {
      return {
        reason: err.response.data.reason,
        message: err.response.data.message,
        details: err.response.data.details,
      };
    }
    return null;
  }, [tokenQuery.error]);

  const serverBlock = heartbeatBlock ?? tokenParentalBlock;
  const blockedByTime =
    watchTime.isOver || serverBlock?.reason === "TIME_LIMIT";
  const blockedByHours =
    watchTime.isOutsideAllowedHours || serverBlock?.reason === "OUTSIDE_HOURS";
  const blockedByServerMaturity = serverBlock?.reason === "MATURITY";

  const adQuery = useQuery({
    queryKey: ["preroll-ad", video?.id, activeProfile?.id, adNonce.current],
    queryFn: () => getPrerollAd(video!.id, activeProfile?.id),
    /** Wait for playback token so adMode matches the same access decision (avoids racing preroll before token). */
    enabled:
      !!video?.id &&
      tokenQuery.isSuccess &&
      tokenQuery.data.adMode !== "none",
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
    if (!sessionId) return;
    sendHeartbeat(sessionId).catch((err) => {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === 403 &&
        err.response.data?.code === "PARENTAL_BLOCKED"
      ) {
        setHeartbeatBlock({
          reason: err.response.data.reason,
          message: err.response.data.message,
          details: err.response.data.details,
        });
        sessionEndedRef.current = true;
      }
    });
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

  // Tick the per-profile daily watch budget every second while real content
  // is on-screen (skip the preroll ad and any blocked state).
  const watchIncrementRef = useRef(watchTime.increment);
  watchIncrementRef.current = watchTime.increment;
  const shouldCountTime =
    !!video &&
    !blockedByMaturity &&
    !blockedByTime &&
    !blockedByHours &&
    !showingAd &&
    !!activeProfile?.id;
  useEffect(() => {
    if (!shouldCountTime) return;
    const id = setInterval(() => watchIncrementRef.current(1), 1000);
    return () => clearInterval(id);
  }, [shouldCountTime]);

  if (videoQuery.isLoading || tokenQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Spinner size="lg" />
      </div>
    );
  }

  if (video && blockedByHours) {
    const range = parentalControls?.allowedHours;
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <Moon className="mb-4 h-12 w-12 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Outside allowed hours
        </h2>
        <p className="mb-6 max-w-md text-center text-surface-400">
          {range
            ? `${activeProfile?.name ?? "This profile"} can watch between ${formatHour(range.start)} and ${formatHour(range.end)}.`
            : "This profile is currently outside its allowed watch window."}
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/profiles/select?force=1">Switch profile</Link>
          </Button>
          <Button asChild>
            <Link to="/account/parental-controls">Adjust controls</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (video && blockedByTime) {
    const limit =
      (serverBlock?.details?.dailyTimeLimitMinutes as number | undefined) ??
      parentalControls?.dailyTimeLimitMinutes ??
      0;
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <Clock className="mb-4 h-12 w-12 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Time&apos;s up for today
        </h2>
        <p className="mb-1 text-center text-surface-400">
          {activeProfile?.name ?? "This profile"} has reached today&apos;s
          {" "}
          <span className="font-semibold text-white">{limit} min</span> watch
          limit.
        </p>
        <p className="mb-6 text-center text-surface-500">
          The budget refreshes at midnight.
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/profiles/select?force=1">Switch profile</Link>
          </Button>
          <Button asChild>
            <Link to="/account/parental-controls">Adjust controls</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (video && (blockedByMaturity || blockedByServerMaturity)) {
    const serverCap = serverBlock?.details?.maxMaturityRating as
      | string
      | undefined;
    const serverVideoRating = serverBlock?.details?.videoMaturityRating as
      | string
      | undefined;
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <Lock className="mb-4 h-12 w-12 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Blocked by parental controls
        </h2>
        <p className="mb-1 text-center text-surface-400">
          This title is rated{" "}
          <span className="font-semibold text-white">
            {serverVideoRating ?? video.maturityRating ?? "NR"}
          </span>
          .
        </p>
        <p className="mb-6 text-center text-surface-400">
          Active profile only allows up to{" "}
          <span className="font-semibold text-white">
            {serverCap ?? activeRatingCap}
          </span>
          .
        </p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/profiles/select?force=1">Switch profile</Link>
          </Button>
          <Button asChild>
            <Link to="/account/parental-controls">Adjust controls</Link>
          </Button>
        </div>
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
    const forbidden =
      axios.isAxiosError(tokenQuery.error) &&
      tokenQuery.error.response?.status === 403;
    if (forbidden) {
      return (
        <Navigate
          to={`/videos/${video.slug}?needsAccess=1`}
          replace
        />
      );
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-4">
        <AlertTriangle className="mb-4 h-12 w-12 text-warning" />
        <h2 className="mb-2 text-xl font-semibold text-white">
          Playback unavailable
        </h2>
        <p className="mb-6 text-center text-surface-400">
          Could not start playback. The server may be temporarily unavailable.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => tokenQuery.refetch()}>
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/videos/${video.slug}`}>Back to video</Link>
          </Button>
        </div>
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
