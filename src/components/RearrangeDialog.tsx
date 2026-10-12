import { useEffect, useRef, useState } from "react";
import { useSubtitleStore } from "../store/subtitleStore";
import { formatTime } from "../lib/timecode";
import { parseRangeTime } from "../lib/rearrange";

export function RearrangeDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { subtitles, selectedIds, rearrange } = useSubtitleStore();
  const sorted = useRef(
    [...subtitles].sort((a, b) => a.start - b.start),
  ).current;
  const selected = useRef(
    sorted.filter((cue) => selectedIds.includes(cue.id)),
  ).current;
  const [scope, setScope] = useState(selected.length ? "selected" : "all");
  const [first, setFirst] = useState("1");
  const [last, setLast] = useState(String(sorted.length));
  const rangeFor = (from: number, to: number) => {
    const cues = sorted.slice(from - 1, to);
    return cues.length
      ? [
          Math.min(...cues.map((c) => c.start)),
          Math.max(...cues.map((c) => c.end)),
        ]
      : [0, 0];
  };
  const rangeOfSelected = selected.length
    ? [
        Math.min(...selected.map((c) => c.start)),
        Math.max(...selected.map((c) => c.end)),
      ]
    : [0, 0];
  const initial = selected.length
    ? rangeOfSelected
    : rangeFor(1, sorted.length);
  const [oldStart, setOldStart] = useState(formatTime(initial[0]));
  const [oldEnd, setOldEnd] = useState(formatTime(initial[1]));
  const [newStart, setNewStart] = useState(formatTime(initial[0]));
  const [newEnd, setNewEnd] = useState(formatTime(initial[1]));
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const refreshRange = (from: string, to: string) => {
    const [start, end] = rangeFor(Number(from), Number(to));
    setOldStart(formatTime(start));
    setOldEnd(formatTime(end));
    setNewStart(formatTime(start));
    setNewEnd(formatTime(end));
    setError("");
  };
  return (
    <dialog ref={dialog} className="rearrange-dialog" onCancel={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const from = scope === "all" ? 1 : Number(first),
              to = scope === "all" ? sorted.length : Number(last);
            if (
              scope !== "selected" &&
              (!Number.isInteger(from) ||
                !Number.isInteger(to) ||
                from < 1 ||
                to < from ||
                to > sorted.length)
            )
              throw new Error(
                `Nomor baris harus antara 1 dan ${sorted.length}.`,
              );
            rearrange(
              (scope === "selected"
                ? selected
                : sorted.slice(from - 1, to)
              ).map((c) => c.id),
              parseRangeTime(oldStart),
              parseRangeTime(oldEnd),
              parseRangeTime(newStart),
              parseRangeTime(newEnd),
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <h2>Rearrange Timing</h2>
        <p>
          Sesuaikan waktu mulai, akhir, dan jarak antarbaris secara
          proporsional.
        </p>
        <label>
          Cakupan
          <select
            aria-label="Rearrange scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              if (e.target.value === "all")
                refreshRange("1", String(sorted.length));
              else if (e.target.value === "selected") {
                setOldStart(formatTime(rangeOfSelected[0]));
                setOldEnd(formatTime(rangeOfSelected[1]));
                setNewStart(formatTime(rangeOfSelected[0]));
                setNewEnd(formatTime(rangeOfSelected[1]));
                setError("");
              } else refreshRange(first, last);
            }}
          >
            {selected.length > 0 && (
              <option value="selected">
                Baris terpilih ({selected.length})
              </option>
            )}
            <option value="all">Seluruh subtitle</option>
            <option value="range">Rentang nomor baris</option>
          </select>
        </label>
        {scope === "selected" && (
          <p className="muted">
            Baris terpilih:{" "}
            {sorted
              .map((cue, index) =>
                selected.some((c) => c.id === cue.id) ? index + 1 : null,
              )
              .filter((n) => n !== null)
              .join(", ")}
          </p>
        )}
        {scope === "range" && (
          <div className="rearrange-fields">
            <label>
              Dari baris
              <input
                aria-label="First line"
                type="number"
                min="1"
                max={sorted.length}
                value={first}
                onChange={(e) => {
                  setFirst(e.target.value);
                  refreshRange(e.target.value, last);
                }}
              />
            </label>
            <label>
              Sampai baris
              <input
                aria-label="Last line"
                type="number"
                min="1"
                max={sorted.length}
                value={last}
                onChange={(e) => {
                  setLast(e.target.value);
                  refreshRange(first, e.target.value);
                }}
              />
            </label>
          </div>
        )}
        <span className="muted">
          Nomor baris mengikuti urutan tabel saat dialog dibuka.
        </span>
        <div className="rearrange-fields">
          <label>
            Mulai asal
            <input
              aria-label="Original start"
              value={oldStart}
              onChange={(e) => setOldStart(e.target.value)}
            />
          </label>
          <label>
            Akhir asal
            <input
              aria-label="Original end"
              value={oldEnd}
              onChange={(e) => setOldEnd(e.target.value)}
            />
          </label>
          <label>
            Mulai baru
            <input
              aria-label="New start"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
            />
          </label>
          <label>
            Akhir baru
            <input
              aria-label="New end"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
            />
          </label>
        </div>
        <p className="muted">
          Format waktu: MM:SS atau HH:MM:SS.mmm. Contoh: 00:30 → 04:30 menjadi
          00:45 → 03:30.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="rearrange-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Apply Timing
          </button>
        </div>
      </form>
    </dialog>
  );
}
