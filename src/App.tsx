import { useCallback, useEffect, useRef, useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { VideoPlayer } from "./components/VideoPlayer";
import { SubtitleTable } from "./components/SubtitleTable";
import { TimingControls } from "./components/TimingControls";
import { useSubtitleStore } from "./store/subtitleStore";
import { parseAss } from "./lib/assParser";
import { writeAss } from "./lib/assWriter";
import { matchesSubtitle } from "./lib/search";
export default function App() {
  const store = useSubtitleStore();
  const [video, setVideo] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [time, setTime] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState(55);
  const workspace = useRef<HTMLDivElement>(null);
  const report = useCallback((message: string) => setError(message), []);
  const seek = (value: number) => {
    const v = videoRef.current;
    if (v && video) {
      v.currentTime = Math.max(
        0,
        Math.min(value, Number.isFinite(v.duration) ? v.duration : value),
      );
      setTime(v.currentTime);
    }
  };
  const save = useCallback(
    async (saveAs = false) => {
      const s = useSubtitleStore.getState();
      if (!s.document) return false;
      try {
        const result = await window.desktop.saveSubtitle(
          writeAss(s.document, s.subtitles),
          saveAs,
        );
        if (result) {
          s.saved(result.name);
          return true;
        }
      } catch (e) {
        report((e as Error).message);
      }
      return false;
    },
    [report],
  );
  const confirm = useCallback(async () => {
    if (!useSubtitleStore.getState().dirty) return true;
    const decision = await window.desktop.confirmReplace();
    return decision === "discard" || (decision === "save" && (await save()));
  }, [save]);
  const openVideo = async () => {
    try {
      const result = await window.desktop.openVideo();
      if (result) {
        setVideo(result);
        setTime(0);
      }
    } catch (e) {
      report((e as Error).message);
    }
  };
  const openSubtitle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await confirm())) return;
      const result = await window.desktop.openSubtitle();
      if (result) {
        const doc = parseAss(result.content);
        store.load(doc, result.name);
        setError("");
      }
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    window.desktop.setDirty(store.dirty);
    document.title = `${store.name}${store.dirty ? " *" : ""} — Mini ASS Editor`;
  }, [store.dirty, store.name]);
  useEffect(
    () =>
      window.desktop.onCloseRequest(() => {
        void (async () => {
          try {
            if (await confirm()) window.desktop.close();
          } catch (e) {
            report((e as Error).message);
          }
        })();
      }),
    [confirm, report],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("dialog")) return;
      const editing =
        target.matches("input,textarea,select") || target.isContentEditable;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (cmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(e.shiftKey);
        return;
      }
      if (cmd && e.key.toLowerCase() === "o") {
        e.preventDefault();
        if (e.shiftKey) void openSubtitle();
        else void openVideo();
        return;
      }
      if (editing) return;
      const v = videoRef.current;
      if (cmd && e.key === "Enter" && store.selected) {
        e.preventDefault();
        try {
          store.update(
            store.selected,
            e.shiftKey ? { end: time } : { start: time },
          );
        } catch (err) {
          report((err as Error).message);
        }
        return;
      }
      if (!v || !video) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (v.paused) void v.play().catch((err) => report(err.message));
        else v.pause();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        seek(
          v.currentTime +
            (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 0.1 : 1),
        );
      }
      if (e.key === "Home") {
        e.preventDefault();
        seek(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  return (
    <main>
      <Toolbar
        name={store.name}
        dirty={store.dirty}
        videoName={video?.name ?? ""}
        onVideo={() => void openVideo()}
        onSubtitle={() => void openSubtitle()}
        onSave={() => void save()}
        canSave={!!store.document}
      />
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      <div className="workspace" ref={workspace}>
        <section className="video-panel" style={{ height: `${panel}%` }}>
          <VideoPlayer
            url={video?.url ?? null}
            videoRef={videoRef}
            time={time}
            onTime={setTime}
            onError={report}
          />
        </section>
        <div
          className="resize-handle"
          role="separator"
          aria-label="Resize video panel"
          tabIndex={0}
          aria-valuenow={panel}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") setPanel((p) => Math.max(30, p - 2));
            if (e.key === "ArrowDown") setPanel((p) => Math.min(70, p + 2));
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (
              e.currentTarget.hasPointerCapture(e.pointerId) &&
              workspace.current
            ) {
              const rect = workspace.current.getBoundingClientRect();
              setPanel(
                Math.max(
                  30,
                  Math.min(70, ((e.clientY - rect.top) / rect.height) * 100),
                ),
              );
            }
          }}
        />
        <div className="table-caption">
          <span>
            SUBTITLES{" "}
            <b>
              {
                store.subtitles.filter((cue) =>
                  matchesSubtitle(cue, store.searchQuery),
                ).length
              }{" "}
              / {store.subtitles.length}
            </b>
          </span>
          <div className="subtitle-search">
            <input
              ref={searchRef}
              type="search"
              aria-label="Search subtitles"
              placeholder="Search subtitle text…"
              value={store.searchQuery}
              onChange={(event) => store.setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  store.setSearchQuery("");
                  event.preventDefault();
                }
              }}
            />
            {store.searchQuery && (
              <button
                aria-label="Clear search"
                onClick={() => store.setSearchQuery("")}
              >
                ×
              </button>
            )}
          </div>
          <span>
            {store.selectedIds.length} selected · Cmd/Ctrl-click: toggle ·
            Shift-click: range
          </span>
        </div>
        <SubtitleTable
          time={time}
          onSeek={seek}
          onError={report}
          canSyncStart={!!video}
          getCurrentTime={() =>
            videoRef.current && videoRef.current.readyState >= 1
              ? videoRef.current.currentTime
              : null
          }
        />
      </div>
      <TimingControls
        time={time}
        onError={report}
        onSaveAs={() => void save(true)}
      />
    </main>
  );
}
