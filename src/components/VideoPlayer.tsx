import { useEffect, useRef, useState, type RefObject } from "react";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { formatTime } from "../lib/timecode";
export function VideoPlayer({
  url,
  videoRef,
  time,
  onTime,
  onError,
}: {
  url: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  time: number;
  onTime: (time: number) => void;
  onError: (message: string) => void;
}) {
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const dragging = useRef(false);
  const scrubTarget = useRef(0);
  const commitSeek = (target: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(target, video.duration));
    onTime(video.currentTime);
  };
  const finishScrub = () => {
    if (!dragging.current) return;
    dragging.current = false;
    commitSeek(scrubTarget.current);
    setScrubTime(null);
  };
  const [bounds, setBounds] = useState({ width: 640, height: 360 });
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      const container = frame.current;
      const video = videoRef.current;
      if (!container || !video) return;
      const ratio = video.videoWidth / video.videoHeight || 16 / 9;
      const width = Math.min(
        container.clientWidth,
        container.clientHeight * ratio,
      );
      setBounds({ width, height: width / ratio });
    };
    const observer = new ResizeObserver(measure);
    if (frame.current) observer.observe(frame.current);
    videoRef.current?.addEventListener("loadedmetadata", measure);
    return () => {
      observer.disconnect();
      videoRef.current?.removeEventListener("loadedmetadata", measure);
    };
  }, [videoRef]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let callback = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (!video.seeking && !dragging.current) onTime(video.currentTime);
      callback = video.requestVideoFrameCallback(tick);
    };
    if (video.requestVideoFrameCallback)
      callback = video.requestVideoFrameCallback(tick);
    return () => {
      stopped = true;
      if (callback) video.cancelVideoFrameCallback(callback);
    };
  }, [url, videoRef, onTime]);
  return (
    <>
      <div className="video-stage" ref={frame}>
        <video
          ref={videoRef}
          src={url ?? undefined}
          preload="auto"
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            onTime(0);
          }}
          onTimeUpdate={(e) => {
            if (!dragging.current && !e.currentTarget.seeking)
              onTime(e.currentTarget.currentTime);
          }}
          onSeeked={(e) => {
            if (!dragging.current) onTime(e.currentTarget.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() =>
            onError(
              "Video tidak dapat diputar. Pastikan codec MP4/MOV didukung Chromium (misalnya H.264 + AAC).",
            )
          }
        />
        {url ? (
          <div
            style={{
              position: "absolute",
              width: bounds.width,
              height: bounds.height,
              pointerEvents: "none",
            }}
          >
            <SubtitleOverlay time={time} width={bounds.width} />
          </div>
        ) : (
          <div className="empty">
            <span className="empty-icon">▷</span>
            <strong>Open a video to begin</strong>
            <span>MP4 · MOV · WebM · Files stay on your Mac</span>
          </div>
        )}
      </div>
      <div className="playback">
        <button
          disabled={!url}
          onClick={() => {
            const v = videoRef.current;
            if (v) {
              if (v.paused) void v.play().catch((e) => onError(e.message));
              else v.pause();
            }
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <span className="time">{formatTime(scrubTime ?? time)}</span>
        <input
          aria-label="Seek video"
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          step="0.001"
          value={Math.min(
            scrubTime ?? time,
            Number.isFinite(duration) ? duration : 0,
          )}
          disabled={!url || !Number.isFinite(duration) || duration <= 0}
          onPointerDown={(e) => {
            dragging.current = true;
            scrubTarget.current = Number(e.currentTarget.value);
            setScrubTime(scrubTarget.current);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={finishScrub}
          onLostPointerCapture={finishScrub}
          onPointerCancel={finishScrub}
          onChange={(e) => {
            const target = Number(e.target.value);
            scrubTarget.current = target;
            if (dragging.current) setScrubTime(target);
            else commitSeek(target);
          }}
        />
        <span className="time">
          {formatTime(Number.isFinite(duration) ? duration : 0)}
        </span>
        <select
          aria-label="Playback speed"
          defaultValue="1"
          onChange={(e) => {
            if (videoRef.current)
              videoRef.current.playbackRate = Number(e.target.value);
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
        <input
          className="volume"
          type="range"
          aria-label="Volume"
          min="0"
          max="1"
          step="0.05"
          defaultValue="1"
          onChange={(e) => {
            if (videoRef.current)
              videoRef.current.volume = Number(e.target.value);
          }}
        />
      </div>
    </>
  );
}
