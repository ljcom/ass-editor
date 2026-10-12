import type { AssDocument, Subtitle } from "../types/subtitle";
import { parseTime, validateTiming } from "./timecode";
export const defaultFormat = [
  "Layer",
  "Start",
  "End",
  "Style",
  "Name",
  "MarginL",
  "MarginR",
  "MarginV",
  "Effect",
  "Text",
];
// Text can occur anywhere in Format: consume fixed fields from both ends.
export function splitFields(value: string, format: string[]): string[] {
  const textIndex = format.findIndex((x) => x.toLowerCase() === "text");
  if (textIndex < 0) {
    const parts = value.split(",");
    if (parts.length !== format.length)
      throw new Error("Jumlah field ASS tidak sesuai Format.");
    return parts;
  }
  let rest = value;
  const before: string[] = [];
  const after: string[] = [];
  for (let i = 0; i < textIndex; i++) {
    const at = rest.indexOf(",");
    if (at < 0) throw new Error("Dialogue ASS tidak lengkap.");
    before.push(rest.slice(0, at));
    rest = rest.slice(at + 1);
  }
  for (let i = format.length - 1; i > textIndex; i--) {
    const at = rest.lastIndexOf(",");
    if (at < 0) throw new Error("Dialogue ASS tidak lengkap.");
    after.unshift(rest.slice(at + 1));
    rest = rest.slice(0, at);
  }
  return [...before, rest, ...after];
}
export function parseAss(content: string): AssDocument {
  const doc: AssDocument = {
    lines: [],
    subtitles: [],
    styles: {},
    info: {},
    format: defaultFormat,
    newline: content.includes("\r\n") ? "\r\n" : "\n",
  };
  let section = "";
  let eventFormat: string[] | undefined;
  let styleFormat: string[] = [];
  const raws = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  raws.forEach((raw, index) => {
    const line: { raw: string; cueId?: string; format?: string[] } = { raw };
    doc.lines.push(line);
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(raw);
    if (header) {
      section = header[1].toLowerCase();
      return;
    }
    const item = /^\s*([^:]+):\s?(.*)$/.exec(raw);
    if (!item) return;
    const key = item[1].trim().toLowerCase();
    const value = item[2];
    if (section === "script info") doc.info[item[1].trim()] = value;
    if (section === "v4+ styles" || section === "v4 styles") {
      if (key === "format") styleFormat = value.split(",").map((x) => x.trim());
      if (key === "style" && styleFormat.length) {
        const values = value.split(",");
        const fields = Object.fromEntries(
          styleFormat.map((k, i) => [k.toLowerCase(), values[i]?.trim() ?? ""]),
        );
        doc.styles[fields.name] = fields;
      }
    }
    if (section === "events") {
      if (key === "format") {
        eventFormat = value.split(",").map((x) => x.trim());
        doc.format = eventFormat;
      }
      if (key === "dialogue") {
        if (!eventFormat)
          throw new Error(
            `Baris ${index + 1}: Dialogue membutuhkan Format di [Events].`,
          );
        try {
          const values = splitFields(value, eventFormat);
          const fields = Object.fromEntries(
            eventFormat.map((k, i) => [k.toLowerCase(), values[i]]),
          );
          if (
            fields.start === undefined ||
            fields.end === undefined ||
            fields.text === undefined
          )
            throw new Error("Format membutuhkan Start, End, Text.");
          const start = parseTime(fields.start),
            end = parseTime(fields.end);
          validateTiming(start, end);
          const id = crypto.randomUUID();
          doc.subtitles.push({
            id,
            start,
            end,
            text: fields.text,
            style: fields.style?.trim() || "Default",
            speaker: fields.name ?? fields.actor ?? "",
            fields,
          });
          line.cueId = id;
          line.format = [...eventFormat];
        } catch (error) {
          throw new Error(`Baris ${index + 1}: ${(error as Error).message}`);
        }
      }
    }
  });
  if (!doc.lines.some((l) => /^\s*\[events\]/i.test(l.raw)))
    throw new Error("File tidak memiliki bagian [Events].");
  return doc;
}
