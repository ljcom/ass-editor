import type { Subtitle } from "../types/subtitle";
import { formatTime, validateTiming } from "./timecode";

export function syncLineStart(
  subtitles: Subtitle[],
  id: string,
  currentTime: number,
  videoDuration?: number,
): Subtitle[] {
  if (!Number.isFinite(currentTime) || currentTime < 0)
    throw new Error("Waktu video belum tersedia.");
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const index = sorted.findIndex((cue) => cue.id === id);
  if (index < 0) throw new Error("Baris subtitle tidak ditemukan.");
  const cue = sorted[index];
  const start = Math.floor(currentTime * 1000 + 1e-6) / 1000;
  const knownDuration =
    videoDuration !== undefined &&
    Number.isFinite(videoDuration) &&
    videoDuration > 0
      ? videoDuration
      : undefined;
  const durationOf = (line: Subtitle) => {
    const duration = line.end - line.start;
    return knownDuration !== undefined && duration > knownDuration
      ? 2
      : duration;
  };
  // An End outside the video is not a useful anchor when repairing a line.
  const invalidEnd = knownDuration !== undefined && cue.end > knownDuration;
  // Moving the Start shifts the End by the same amount.
  const end = Math.round((start + durationOf(cue)) * 1000) / 1000;
  const effectiveEnd =
    invalidEnd && knownDuration !== undefined && knownDuration - start >= 0.01
      ? Math.min(end, knownDuration)
      : end;
  if (knownDuration !== undefined && knownDuration - start < 0.01)
    throw new Error("Pilih waktu setidaknya 10 ms sebelum akhir lagu.");
  const previousEnd = Math.round((start - 0.1) * 1000) / 1000;
  const validate = (a: number, b: number) => {
    validateTiming(a, b);
    if (formatTime(a, true) === formatTime(b, true))
      throw new Error("Durasi terlalu pendek untuk presisi ASS (10 ms).");
  };
  validate(start, effectiveEnd);
  const changed = new Map<string, Subtitle>([
    [id, { ...cue, start, end: effectiveEnd }],
  ]);
  // Trim overlapping rows above the new Start without extending other rows.
  for (const previous of sorted) {
    if (previous.id === id || previous.start >= start || previous.end <= start)
      continue;
    if (
      previousEnd > previous.start &&
      formatTime(previous.start, true) !== formatTime(previousEnd, true)
    ) {
      validate(previous.start, previousEnd);
      changed.set(previous.id, { ...previous, end: previousEnd });
    }
  }
  // Move conflicting rows behind the clicked row, retaining their durations.
  // A shifted row may push the next row as well. Stop once there is a gap.
  let boundary = effectiveEnd;
  const shiftedIds = [id];
  for (const original of sorted) {
    if (original.id === id) continue;
    const line = changed.get(original.id) ?? original;
    if (line.end <= start) continue;
    const nextStart = Math.round((boundary + 0.01) * 1000) / 1000;
    if (line.start >= nextStart) break;
    const nextEnd =
      Math.round((nextStart + durationOf(original)) * 1000) / 1000;
    validate(nextStart, nextEnd);
    changed.set(line.id, { ...original, start: nextStart, end: nextEnd });
    shiftedIds.push(line.id);
    boundary = nextEnd;
  }
  if (knownDuration !== undefined && boundary > knownDuration) {
    // Keep the clicked Start anchored. Fit only the affected chain into the
    // remaining song, reserving 10 ms per cue and 10 ms between cues.
    const spanMs = Math.floor((knownDuration - start) * 1000 + 1e-6);
    const minimumMs = shiftedIds.length * 10 + (shiftedIds.length - 1) * 10;
    if (spanMs < minimumMs)
      throw new Error(
        "Sisa lagu terlalu pendek untuk baris yang konflik. Pilih Start lebih awal atau kurangi jumlah baris.",
      );
    const weights = shiftedIds.map((key) => {
      const line = changed.get(key)!;
      return line.end - line.start;
    });
    const total = weights.reduce((sum, value) => sum + value, 0);
    const extraMs = spanMs - minimumMs;
    let cumulativeWeight = 0,
      allocatedMs = 0,
      cursorMs = Math.round(start * 1000);
    shiftedIds.forEach((key, index) => {
      const line = changed.get(key)!;
      cumulativeWeight += weights[index];
      const cumulativeMs =
        index === shiftedIds.length - 1
          ? extraMs
          : Math.round((extraMs * cumulativeWeight) / total);
      const durationMs = 10 + cumulativeMs - allocatedMs;
      const nextStart = cursorMs / 1000,
        nextEnd = (cursorMs + durationMs) / 1000;
      validate(nextStart, nextEnd);
      changed.set(key, { ...line, start: nextStart, end: nextEnd });
      allocatedMs = cumulativeMs;
      cursorMs += durationMs + 10;
    });
  }
  return subtitles.map((line) => changed.get(line.id) ?? line);
}
