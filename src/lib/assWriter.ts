import type { AssDocument, Subtitle } from "../types/subtitle";
import { formatTime, validateTiming } from "./timecode";
export function writeAss(doc: AssDocument, subtitles: Subtitle[]): string {
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const formats = new Map(
    doc.lines
      .filter((line) => line.cueId)
      .map((line) => [line.cueId!, line.format ?? doc.format]),
  );
  let next = 0;
  const writeInFormat = (cue: Subtitle, activeFormat: string[]) => {
    const format = formats.get(cue.id) ?? doc.format;
    if (format.join(",") === activeFormat.join(","))
      return [dialogue(cue, format)];
    // Restore the original format after a moved Dialogue so comments and other
    // non-dialogue events continue to use their original field mapping.
    return [
      "Format: " + format.join(", "),
      dialogue(cue, format),
      "Format: " + activeFormat.join(", "),
    ];
  };
  const dialogue = (cue: Subtitle, format: string[]) => {
    validateTiming(cue.start, cue.end);
    if (formatTime(cue.end, true) === formatTime(cue.start, true))
      throw new Error("Durasi terlalu pendek untuk presisi ASS (10 ms).");
    const fields = {
      ...cue.fields,
      start: formatTime(cue.start, true),
      end: formatTime(cue.end, true),
      text: cue.text.replace(/\r?\n/g, "\\N"),
      style: cue.style,
      name: cue.speaker,
      actor: cue.speaker,
    };
    return (
      "Dialogue: " +
      format
        .map((k) => fields[k.toLowerCase() as keyof typeof fields] ?? "")
        .join(",")
    );
  };
  const output = doc.lines.flatMap((line) => {
    if (!line.cueId) return [line.raw];
    const cue = sorted[next++];
    return cue ? writeInFormat(cue, line.format ?? doc.format) : [];
  });
  const added = sorted.slice(next);
  if (added.length) {
    let at = output.findIndex((l) => /^\s*\[events\]/i.test(l)) + 1;
    while (at < output.length && !/^\s*\[/.test(output[at])) at++;
    output.splice(
      at,
      0,
      "Format: " + doc.format.join(", "),
      ...added.flatMap((s) => writeInFormat(s, doc.format)),
    );
  }
  return output.join(doc.newline);
}
