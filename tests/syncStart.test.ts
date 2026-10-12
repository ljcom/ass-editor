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
  it("keeps Start at or before the paused frame instead of rounding into the future", () => {
    const current = 161.246789;
    const result = syncLineStart(
      [cue("a", 187.63, 189.63)],
      "a",
      current,
      268.842333,
    );
    expect(result[0].start).toBe(161.246);
    expect(result[0].start).toBeLessThanOrEqual(current);
    expect(result[0].end).toBeGreaterThan(current);
  });
  it("keeps a moved-earlier row at 2:41 without inflating its duration", () => {
    const input = [
      cue("a", 159.49, 160.4),
      cue("b", 187.63, 189.63),
      cue("c", 189.96, 191.96),
    ];
    const result = syncLineStart(input, "b", 161.246, 268.842333);
    expect(result[1]).toMatchObject({ start: 161.246, end: 163.246 });
    expect(result[0]).toBe(input[0]);
    expect(result[2]).toBe(input[2]);
  });
  it("fits overflowing conflicts inside the song with 10 ms gaps", () => {
    const input = [
      cue("a", 157, 160),
      cue("b", 162, 240),
      cue("c", 163, 242),
      cue("target", 250, 252),
    ];
    const result = syncLineStart(input, "target", 161.246, 268.842333);
    const group = ["target", "b", "c"].map((id) =>
      result.find((c) => c.id === id)!,
    );
    expect(group[0].start).toBe(161.246);
    expect(group[2].end).toBe(268.842);
    group.forEach((c, index) => {
      expect(c.end).toBeLessThanOrEqual(268.842333);
      expect(c.end - c.start).toBeGreaterThanOrEqual(0.009999);
      if (index) expect(c.start - group[index - 1].end).toBeCloseTo(0.01, 6);
    });
    expect(result[0]).toBe(input[0]);
  });
  it("keeps repeated Set Start operations anchored and highlights the clicked ID", () => {
    const doc = parseAss(
      "[Events]\nFormat: Start, End, Text\nDialogue: 0:02:42.00,0:04:00.00,First\nDialogue: 0:02:43.00,0:04:02.00,Second\nDialogue: 0:04:10.00,0:04:12.00,Target",
    );
    const s = useSubtitleStore.getState();
    s.load(doc, "song.ass");
    const id = doc.subtitles[2].id;
    for (const time of [161.246, 162.5, 163.2]) {
      s.syncStart(id, time, 268.842333);
      const state = useSubtitleStore.getState();
      expect(state.subtitles.find((c) => c.id === id)!.start).toBe(time);
      expect(state.selected).toBe(id);
      expect(state.selectedIds).toEqual([id]);
      state.subtitles.forEach((c) =>
        expect(c.end).toBeLessThanOrEqual(268.842333),
      );
    }
  });
  it("rejects a start at the video end without creating past-song timestamps", () => {
    expect(() =>
      syncLineStart([cue("a", 1, 3)], "a", 268.842, 268.842333),
    ).toThrow("10 ms");
  });
  it("repairs an astronomical End instead of carrying it forward", () => {
    const input = [
      cue("a", 192.54, 3133396683.14),
      cue("b", 3133396683.15, 4700094916.94),
    ];
    const result = syncLineStart(input, "b", 200, 268.842);
    expect(result[1]).toMatchObject({ start: 200, end: 202 });
    expect(result[0]).toMatchObject({ start: 192.54, end: 199.9 });
    expect(input[1].start).toBe(3133396683.15);
  });
  it("bounds malformed conflict durations and clamps End near video end", () => {
    const input = [
      cue("a", 192.54, 3133396683.14),
      cue("b", 3133396683.15, 4700094916.94),
    ];
    const result = syncLineStart(input, "b", 192.545, 268.842);
    expect(result[1]).toMatchObject({ start: 192.545, end: 194.545 });
    expect(result[0]).toMatchObject({ start: 194.555, end: 196.555 });
    expect(syncLineStart([input[1]], "b", 268, 268.842)[0]).toMatchObject({
      start: 268,
      end: 268.842,
    });
  });
  it("preserves reasonable durations when moving a line from beyond the video", () => {
    expect(
      syncLineStart([cue("a", 600, 604)], "a", 40, 268.842)[0],
    ).toMatchObject({ start: 40, end: 44 });
  });
  it("trims overlapping rows above the new Start by 100 ms", () => {
    const input = [cue("a", 1, 8), cue("b", 10, 12), cue("c", 20, 22)];
    const result = syncLineStart(input, "b", 5.123);
    expect(result[0].end).toBe(5.023);
    expect(result[1]).toMatchObject({ start: 5.123, end: 7.123, text: "b" });
    expect(result[2]).toBe(input[2]);
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
    expect(result[0]).toMatchObject({ start: 0, end: 2 });
    expect(result[1]).toBe(lines[1]);
  });
  it("uses the order shown in the table rather than source file order", () => {
    const result = syncLineStart([lines[2], lines[0], lines[1]], "b", 5);
    expect(result[1]).toBe(lines[0]);
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
      end: 3.005,
    });
    expect(result.subtitles[1]).toMatchObject({
      id: before[0].id,
      start: 3.015,
      end: 5.015,
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
      [3, 3.9],
      [6.01, 8.01],
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
    expect(() => syncLineStart([cue("tiny", 1, 1.001)], "tiny", 5)).toThrow();
  });
});
