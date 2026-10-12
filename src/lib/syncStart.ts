import type { Subtitle } from "../types/subtitle";
import { formatTime, validateTiming } from "./timecode";

export function syncLineStart(
  subtitles: Subtitle[],
  id: string,
  currentTime: number,
): Subtitle[] {
  if (!Number.isFinite(currentTime) || currentTime < 0)
    throw new Error("Waktu video belum tersedia.");
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const index = sorted.findIndex((cue) => cue.id === id);
  if (index < 0) throw new Error("Baris subtitle tidak ditemukan.");
  const cue = sorted[index],
    previous = sorted[index - 1];
  const start = Math.round(currentTime * 1000) / 1000;
  // Preserve the end when possible; when moving beyond it, keep the old duration.
  const end =
    cue.end > start
      ? cue.end
      : Math.round((start + cue.end - cue.start) * 1000) / 1000;
  const previousEnd = Math.round((start - 0.01) * 1000) / 1000;
  const validate = (a: number, b: number) => {
    validateTiming(a, b);
    if (formatTime(a, true) === formatTime(b, true))
      throw new Error("Durasi terlalu pendek untuk presisi ASS (10 ms).");
  };
  validate(start, end);
  const changed = new Map<string, Subtitle>([[id, { ...cue, start, end }]]);
  if (
    previous &&
    previousEnd > previous.start &&
    formatTime(previous.start, true) !== formatTime(previousEnd, true)
  ) {
    validate(previous.start, previousEnd);
    changed.set(previous.id, { ...previous, end: previousEnd });
  }
  // Move conflicting rows behind the clicked row, retaining their durations.
  // A shifted row may push the next row as well. Stop once there is a gap.
  let boundary = end;
  for (const original of sorted) {
    if (original.id === id) continue;
    const line = changed.get(original.id) ?? original;
    if (line.end <= start) continue;
    const nextStart = Math.round((boundary + 0.01) * 1000) / 1000;
    if (line.start >= nextStart) break;
    const nextEnd =
      Math.round((nextStart + original.end - original.start) * 1000) / 1000;
    validate(nextStart, nextEnd);
    changed.set(line.id, { ...original, start: nextStart, end: nextEnd });
    boundary = nextEnd;
  }
  return subtitles.map((line) => changed.get(line.id) ?? line);
}
