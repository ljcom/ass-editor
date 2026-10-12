import { describe, it, expect } from "vitest";
import { parseRangeTime, rearrangeSubtitles } from "../src/lib/rearrange";
import { useSubtitleStore } from "../src/store/subtitleStore";
import { parseAss } from "../src/lib/assParser";
import { writeAss } from "../src/lib/assWriter";
import type { Subtitle } from "../src/types/subtitle";
const cue = (id: string, start: number, end: number): Subtitle => ({
  id,
  start,
  end,
  text: "{\\i1}Text " + id,
  style: "Default",
  speaker: "Singer",
  fields: { effect: "keep" },
});
const cues = [
  cue("1", 30, 60),
  cue("2", 70, 100),
  cue("3", 100, 140),
  cue("4", 180, 220),
  cue("5", 240, 270),
  cue("6", 280, 300),
];
describe("rearrange timing", () => {
  it("maps lines 1–5 from 00:30–04:30 into 00:45–03:30", () => {
    const result = rearrangeSubtitles(
      cues,
      ["1", "2", "3", "4", "5"],
      30,
      270,
      45,
      210,
    );
    expect(result[0].start).toBe(45);
    expect(result[4].end).toBe(210);
    expect(result[0].end).toBe(65.625);
    expect(result[1].start).toBe(72.5);
    expect(result[5]).toBe(cues[5]);
    result.slice(0, 5).forEach((c, i) => {
      expect(c.text).toBe(cues[i].text);
      expect(c.fields).toBe(cues[i].fields);
      expect(c.style).toBe(cues[i].style);
    });
  });
  it("expands a whole song and preserves overlaps", () => {
    const input = [cue("a", 0, 2), cue("b", 1, 3)];
    const result = rearrangeSubtitles(input, ["a", "b"], 0, 3, 10, 16);
    expect(result.map((c) => [c.start, c.end])).toEqual([
      [10, 14],
      [12, 16],
    ]);
  });
  it("handles a single line and shifts without scaling", () => {
    expect(
      rearrangeSubtitles([cue("a", 1, 2)], ["a"], 1, 2, 5, 6)[0],
    ).toMatchObject({ start: 5, end: 6 });
  });
  it("rejects invalid bounds, out-of-range rows, missing selection and collapsed ASS timing", () => {
    expect(() => rearrangeSubtitles(cues, ["1"], 30, 30, 45, 210)).toThrow();
    expect(() => rearrangeSubtitles(cues, ["1"], 30, 270, -1, 210)).toThrow();
    expect(() => rearrangeSubtitles(cues, ["1"], 40, 270, 45, 210)).toThrow();
    expect(() => rearrangeSubtitles(cues, [], 30, 270, 45, 210)).toThrow();
    expect(() =>
      rearrangeSubtitles(cues, ["missing"], 30, 270, 45, 210),
    ).toThrow();
    expect(() =>
      rearrangeSubtitles(cues, ["1", "5"], 30, 270, 0, 0.01),
    ).toThrow();
  });
  it("supports minute and full hour time inputs", () => {
    expect(parseRangeTime("00:30")).toBe(30);
    expect(parseRangeTime("04:30")).toBe(270);
    expect(parseRangeTime("03:30.125")).toBe(210.125);
    expect(parseRangeTime("01:04:30")).toBe(3870);
    expect(() => parseRangeTime("04:75")).toThrow();
  });
  it("applies one atomic store change, keeps non-selected lines, and saves valid ASS", () => {
    const doc = parseAss(
      "[Events]\nFormat: Start, End, Text\nDialogue: 0:00:30.00,0:01:00.00,First\nDialogue: 0:04:00.00,0:04:30.00,Last\nDialogue: 0:04:40.00,0:05:00.00,Outside",
    );
    const store = useSubtitleStore.getState();
    store.load(doc, "song.ass");
    const before = useSubtitleStore.getState().subtitles;
    expect(() =>
      store.rearrange(
        before.map((c) => c.id),
        30,
        270,
        45,
        210,
      ),
    ).toThrow();
    expect(useSubtitleStore.getState().subtitles).toBe(before);
    expect(useSubtitleStore.getState().dirty).toBe(false);
    store.rearrange(
      before.slice(0, 2).map((c) => c.id),
      30,
      270,
      45,
      210,
    );
    const state = useSubtitleStore.getState();
    expect(state.dirty).toBe(true);
    const saved = parseAss(writeAss(state.document!, state.subtitles));
    expect(saved.subtitles.map((c) => [c.start, c.end])).toEqual([
      [45, 65.63],
      [189.38, 210],
      [280, 300],
    ]);
  });
});
