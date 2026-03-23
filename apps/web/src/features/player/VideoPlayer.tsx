import { useEffect, useRef, useCallback } from "react";
import MuxPlayer from "@mux/mux-player-react";

interface VideoPlayerProps {
  playbackId: string;
  token?: string;
  title?: string;
  /** @default true */
  autoPlay?: boolean;
  onHeartbeat?: () => void;
  onEnd?: () => void;
  heartbeatIntervalMs?: number;
  className?: string;
}

export function VideoPlayer({
  playbackId,
  token,
  title,
  autoPlay = true,
  onHeartbeat,
  onEnd,
  heartbeatIntervalMs = 30_000,
  className,
}: VideoPlayerProps) {
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const onHeartbeatRef = useRef(onHeartbeat);
  onHeartbeatRef.current = onHeartbeat;

  useEffect(() => {
    if (!onHeartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => {
      onHeartbeatRef.current?.();
    }, heartbeatIntervalMs);

    return () => {
      clearInterval(heartbeatRef.current);
    };
  }, [heartbeatIntervalMs]);

  const handleEnded = useCallback(() => {
    onEnd?.();
  }, [onEnd]);

  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={token ? { playback: token } : undefined}
      metadata={{ video_title: title }}
      streamType="on-demand"
      autoPlay={autoPlay}
      onEnded={handleEnded}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
