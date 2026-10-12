import { useState, useRef, useLayoutEffect } from "react";
import { useSubtitleStore } from "../store/subtitleStore";
import { formatTime, parseTime } from "../lib/timecode";
import { matchesSubtitle } from "../lib/search";
export function SubtitleTable({
  time,
  onSeek,
  onError,
  getCurrentTime,
  canSyncStart,
  getVideoDuration,
}: {
  time: number;
  onSeek: (time: number) => void;
  onError: (message: string) => void;
  getCurrentTime: () => number | null;
  canSyncStart: boolean;
  getVideoDuration: () => number | undefined;
}) {
  const {
    subtitles,
    selected,
    selectedIds,
    select,
    update,
    remove,
    syncStart,
    syncEnd,
    searchQuery,
  } = useSubtitleStore();
  const rowElements = useRef(new Map<string, HTMLTableRowElement>());
  const pendingScroll = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (pendingScroll.current) {
      rowElements.current
        .get(pendingScroll.current)
        ?.scrollIntoView({ block: "nearest" });
      pendingScroll.current = null;
    }
  }, [subtitles]);
  const [edit, setEdit] = useState<{
    id: string;
    field: "start" | "end" | "text" | "style";
    value: string;
  } | null>(null);
  const rows = [...subtitles]
    .sort((a, b) => a.start - b.start)
    .map((cue, index) => ({ cue, index }))
    .filter(({ cue }) => matchesSubtitle(cue, searchQuery));
  const commit = () => {
    if (!edit) return;
    try {
      update(edit.id, {
        [edit.field]:
          edit.field === "start" || edit.field === "end"
            ? parseTime(edit.value)
            : edit.value,
      });
      setEdit(null);
    } catch (e) {
      onError((e as Error).message);
    }
  };
  return (
    <div
      className="table-panel"
      tabIndex={0}
      aria-label="Subtitle table"
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === "Delete" && selected) {
          remove();
          e.preventDefault();
        }
      }}
    >
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
            <th>Style</th>
            <th>Text</th>
            <th className="line-actions-header">Timing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cue, index }) => (
            <tr
              key={cue.id}
              ref={(element) => {
                if (element) rowElements.current.set(cue.id, element);
                else rowElements.current.delete(cue.id);
              }}
              aria-selected={selectedIds.includes(cue.id)}
              className={`${selectedIds.includes(cue.id) ? "selected" : ""} ${cue.start <= time && time < cue.end ? "active" : ""}`}
              onMouseDown={(e) => {
                if (e.shiftKey) e.preventDefault();
              }}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("input,textarea,button"))
                  return;
                select(cue.id, {
                  toggle: e.metaKey || e.ctrlKey,
                  range: e.shiftKey,
                });
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey) onSeek(cue.start);
                e.currentTarget.closest<HTMLElement>(".table-panel")?.focus();
              }}
            >
              <td className="row-number">{index + 1}</td>
              {(["start", "end"] as const).map((field) => (
                <td
                  key={field}
                  onDoubleClick={() =>
                    setEdit({
                      id: cue.id,
                      field,
                      value: formatTime(cue[field]),
                    })
                  }
                >
                  {edit?.id === cue.id && edit.field === field ? (
                    <input
                      autoFocus
                      aria-label={`Edit ${field}`}
                      value={edit.value}
                      onChange={(e) =>
                        setEdit({ ...edit, value: e.target.value })
                      }
                      onBlur={commit}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEdit(null);
                      }}
                    />
                  ) : (
                    <>
                      <span
                        className="line-time"
                        title={formatTime(cue[field])}
                      >
                        {formatTime(cue[field])}
                      </span>
                    </>
                  )}
                </td>
              ))}
              <td className="muted">{(cue.end - cue.start).toFixed(3)}s</td>
              {(["style", "text"] as const).map((field) => (
                <td
                  key={field}
                  className={field === "text" ? "text-cell" : ""}
                  onDoubleClick={() =>
                    setEdit({ id: cue.id, field, value: cue[field] })
                  }
                >
                  {edit?.id === cue.id && edit.field === field ? (
                    field === "text" ? (
                      <textarea
                        autoFocus
                        aria-label="Edit text"
                        wrap="soft"
                        rows={2}
                        ref={(element) => {
                          if (element) {
                            element.style.height = "auto";
                            element.style.height = `${Math.max(60, element.scrollHeight)}px`;
                          }
                        }}
                        value={edit.value}
                        onChange={(event) =>
                          setEdit({ ...edit, value: event.target.value })
                        }
                        onBlur={commit}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (
                            event.key === "Enter" &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                          ) {
                            event.preventDefault();
                            commit();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEdit(null);
                          }
                        }}
                      />
                    ) : (
                      <input
                        autoFocus
                        aria-label={`Edit ${field}`}
                        value={edit.value}
                        onChange={(e) =>
                          setEdit({ ...edit, value: e.target.value })
                        }
                        onBlur={commit}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") commit();
                          if (e.key === "Escape") setEdit(null);
                        }}
                      />
                    )
                  ) : (
                    cue[field] || "—"
                  )}
                </td>
              ))}
              <td className="line-actions">
                <button
                  className="line-set-start"
                  aria-label={`Set start line ${index + 1}`}
                  title="Set Start ke waktu video; baris di atas yang overlap berakhir 100 ms sebelumnya, baris konflik digeser ke sesudahnya"
                  disabled={!canSyncStart}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    try {
                      const current = getCurrentTime();
                      if (current === null)
                        throw new Error(
                          "Buka video dan tunggu hingga siap diputar.",
                        );
                      pendingScroll.current = cue.id;
                      syncStart(cue.id, current, getVideoDuration());
                    } catch (error) {
                      pendingScroll.current = null;
                      onError((error as Error).message);
                    }
                  }}
                >
                  Set Start
                </button>
                <button
                  className="line-set-end"
                  aria-label={`Set end line ${index + 1}`}
                  title="Set End ke waktu video saat ini"
                  disabled={!canSyncStart}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    try {
                      const current = getCurrentTime();
                      if (current === null)
                        throw new Error("Buka video dan tunggu hingga siap diputar.");
                      pendingScroll.current = cue.id;
                      syncEnd(cue.id, current);
                    } catch (error) {
                      pendingScroll.current = null;
                      onError((error as Error).message);
                    }
                  }}
                >
                  Set End
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {subtitles.length > 0 && rows.length === 0 && (
        <div className="table-empty">
          Tidak ada subtitle yang cocok dengan pencarian.
        </div>
      )}
      {!subtitles.length && (
        <div className="table-empty">
          Open an ASS file to edit subtitles.
          <small>
            Double-click a cell to edit · Enter to save · Escape to cancel
          </small>
        </div>
      )}
    </div>
  );
}
