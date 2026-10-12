export function parseTime(value: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(value.trim());
  if (!match || +match[2] > 59 || +match[3] > 59)
    throw new Error("Use HH:MM:SS.mmm (contoh 00:01:23.450).");
  return (
    +match[1] * 3600 +
    +match[2] * 60 +
    +match[3] +
    +match[4].padEnd(3, "0") / 1000
  );
}
export function formatTime(seconds: number, ass = false): string {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Timestamp harus positif dan valid.");
  const scale = ass ? 100 : 1000;
  const ticks = Math.round(seconds * scale);
  const h = Math.floor(ticks / (3600 * scale));
  const m = Math.floor(ticks / (60 * scale)) % 60;
  const s = Math.floor(ticks / scale) % 60;
  return `${ass ? h : String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ticks % scale).padStart(ass ? 2 : 3, "0")}`;
}
export function validateTiming(start: number, end: number): void {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    throw new Error(
      "Start tidak boleh negatif; End harus lebih besar dari Start.",
    );
}
