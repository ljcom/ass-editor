import { describe, it, expect } from "vitest";
import { syncLineStart } from "../src/lib/syncStart";
import { useSubtitleStore } from "../src/store/subtitleStore";
import { parseAss } from "../src/lib/assParser";
import type { Subtitle } from "../src/types/subtitle";
const cue = (id: string, start: number, end: number): Subtitle => ({
  id,
  start,
  end,
  text: id,
  style: "Default",
  speaker: "",
  fields: {},
});
const lines = [cue("a", 1, 3), cue("b", 4, 6), cue("c", 7, 9)];
describe("set row start at current video time", () => {
  it("adjusts previous end to 10 ms before current start atomically", () => {
    const result = syncLineStart(lines, "b", 5.123);
    expect(result[0].end).toBe(5.113);
    expect(result[1]).toMatchObject({ start: 5.123, end: 6, text: "b" });
    expect(result[2]).toBe(lines[2]);
    expect(lines[0].end).toBe(3);
  });
  it("extends the current end with its original duration when needed", () => {
    expect(syncLineStart(lines, "b", 10)[1]).toMatchObject({
      start: 10,
      end: 12,
    });
  });
  it("supports the first line without a previous row", () => {
    const result = syncLineStart(lines, "a", 0);
    expect(result[0]).toMatchObject({ start: 0, end: 3 });
    expect(result[1]).toBe(lines[1]);
  });
  it("uses the order shown in the table rather than source file order", () => {
    const result = syncLineStart([lines[2], lines[0], lines[1]], "b", 5);
    expect(result[1].end).toBe(4.99);
    expect(result[2].start).toBe(5);
  });
  it("moves an invalid previous row behind the clicked row", () => {
    const doc = parseAss(
      "[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:03.00,First\nDialogue: 0:00:04.00,0:00:06.00,Next",
    );
    const s = useSubtitleStore.getState();
    s.load(doc, "song.ass");
    const before = useSubtitleStore.getState().subtitles;
    s.syncStart(before[1].id, 1.005);
    const result = useSubtitleStore.getState();
    expect(result.subtitles[0]).toMatchObject({
      id: before[1].id,
      start: 1.005,
      end: 6,
    });
    expect(result.subtitles[1]).toMatchObject({
      id: before[0].id,
      start: 6.01,
      end: 8.01,
    });
    expect(before[0].start).toBe(1);
    expect(result.dirty).toBe(true);
  });
  it("moves later conflicts with 10 ms gaps and preserves duration", () => {
    const input = [
      cue("a", 1, 3),
      cue("b", 3, 5),
      cue("c", 5, 7),
      cue("d", 20, 22),
    ];
    const result = syncLineStart(input, "a", 4);
    expect(result.map((c) => [c.start, c.end])).toEqual([
      [4, 6],
      [6.01, 8.01],
      [8.02, 10.02],
      [20, 22],
    ]);
    expect(result[3]).toBe(input[3]);
  });
  it("moves conflicts at the same start without losing text or fields", () => {
    const input = [cue("a", 1, 3), cue("b", 1, 4)];
    const result = syncLineStart(input, "a", 1);
    expect(result[1]).toMatchObject({ start: 3.01, end: 6.01, text: "b" });
    expect(result[1].fields).toBe(input[1].fields);
  });
  it("does not alter unrelated overlaps after a gap", () => {
    const input = [cue("a", 1, 3), cue("b", 10, 14), cue("c", 11, 15)];
    const result = syncLineStart(input, "a", 2);
    expect(result[1]).toBe(input[1]);
    expect(result[2]).toBe(input[2]);
  });
  it("rejects negative, nonfinite and sub-centisecond durations", () => {
    for (const time of [-1, NaN, Infinity])
      expect(() => syncLineStart(lines, "b", time)).toThrow();
    expect(() => syncLineStart(lines, "b", 5.999)).toThrow();
  });
});
