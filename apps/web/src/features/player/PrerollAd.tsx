import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { recordAdViewCharge } from "@/api/playbackPublic";

interface PrerollAdProps {
  playbackId: string;
  advertiser?: string;
  /** Bill advertiser when the ad is shown (testing: immediate Stripe charge). */
  billing?: {
    videoId: string;
    campaignId: string;
    creativeId: string;
  };
  onComplete: () => void;
}

const SKIP_DELAY_SECONDS = 5;

export function PrerollAd({
  playbackId,
  advertiser,
  billing,
  onComplete,
}: PrerollAdProps) {
  const [elapsed, setElapsed] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const playerRef = useRef<HTMLElement | null>(null);
  const idempotencyKey = useMemo(() => {
    if (!billing) return null;
    return crypto.randomUUID();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billing?.videoId, billing?.campaignId, billing?.creativeId]);

  useEffect(() => {
    if (!billing || !idempotencyKey) return;
    const { videoId, campaignId, creativeId } = billing;
    let cancelled = false;
    recordAdViewCharge({
      videoId,
      campaignId,
      creativeId,
      idempotencyKey,
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.success && res.errorMessage) {
          console.warn("[ad billing]", res.errorMessage);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn("[ad billing]", err);
      });
    return () => {
      cancelled = true;
    };
  }, [billing, idempotencyKey]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= SKIP_DELAY_SECONDS) {
          setCanSkip(true);
          clearInterval(intervalRef.current);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const handleSkip = useCallback(() => {
    if (canSkip) onComplete();
  }, [canSkip, onComplete]);

  const handleEnded = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const remaining = Math.max(0, SKIP_DELAY_SECONDS - elapsed);

  return (
    <div className="relative h-full w-full bg-black">
      <MuxPlayer
        ref={playerRef as any}
        playbackId={playbackId}
        streamType="on-demand"
        autoPlay
        muted={false}
        onEnded={handleEnded}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Ad badge top-left */}
      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black uppercase tracking-wide">
          Ad
        </span>
        {advertiser && (
          <span className="text-xs text-white/70">{advertiser}</span>
        )}
      </div>

      {/* Skip button bottom-right */}
      <div className="absolute bottom-20 right-4">
        {canSkip ? (
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-2 rounded border border-white/60 bg-black/70 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Skip Ad
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M5 5v14l11-7L5 5zm13 0v14h2V5h-2z" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded border border-white/30 bg-black/70 px-4 py-2 text-sm text-white/70">
            You can skip ad in {remaining}s
          </div>
        )}
      </div>
    </div>
  );
}
