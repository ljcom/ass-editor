import type { Subtitle } from "../types/subtitle";
import { formatTime, parseTime, validateTiming } from "./timecode";

export function parseRangeTime(value: string): number {
  const trimmed = value.trim();
  if (/^\d+:\d{2}(?:[.,]\d{1,3})?$/.test(trimmed))
    return parseTime("00:" + trimmed + (/[.,]/.test(trimmed) ? "" : ".000"));
  if (/^\d+:\d{2}:\d{2}$/.test(trimmed)) return parseTime(trimmed + ".000");
  return parseTime(trimmed);
}

export function rearrangeSubtitles(
  subtitles: Subtitle[],
  ids: string[],
  oldStart: number,
  oldEnd: number,
  newStart: number,
  newEnd: number,
): Subtitle[] {
  validateTiming(oldStart, oldEnd);
  validateTiming(newStart, newEnd);
  const selected = new Set(ids);
  if (
    !selected.size ||
    ids.some((id) => !subtitles.some((cue) => cue.id === id))
  )
    throw new Error("Pilih baris subtitle yang valid.");
  const scale = (newEnd - newStart) / (oldEnd - oldStart);
  const mapTime = (value: number) =>
    Math.round((newStart + (value - oldStart) * scale) * 1000) / 1000;
  return subtitles.map((cue) => {
    if (!selected.has(cue.id)) return cue;
    if (cue.start < oldStart || cue.end > oldEnd)
      throw new Error(
        "Rentang asal harus mencakup seluruh waktu baris yang dipilih.",
      );
    const start = mapTime(cue.start),
      end = mapTime(cue.end);
    validateTiming(start, end);
    if (formatTime(start, true) === formatTime(end, true))
      throw new Error(
        "Rentang baru terlalu pendek: durasi baris akan hilang pada presisi ASS (10 ms).",
      );
    return { ...cue, start, end };
  });
}
