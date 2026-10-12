import { describe, expect, it } from "vitest";
import { parseAss } from "../src/lib/assParser";
import { useSubtitleStore } from "../src/store/subtitleStore";

function load() {
  const doc = parseAss("[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:03.00,First\nDialogue: 0:00:04.00,0:00:06.00,Second");
  useSubtitleStore.getState().load(doc, "test.ass");
  return useSubtitleStore.getState();
}
describe("Set End at current video time", () => {
  it("changes only the clicked End, preserves Start and selects the clicked row", () => {
    const state = load();
    const first = state.subtitles[0];
    state.syncEnd(first.id, 5.246789);
    const result = useSubtitleStore.getState();
    expect(result.subtitles[0]).toEqual({ ...first, end: 5.246 });
    expect(result.subtitles[1]).toBe(state.subtitles[1]);
    expect(result.selectedIds).toEqual([first.id]);
    expect(result.dirty).toBe(true);
  });
  it("rejects End before Start, invalid time and durations lost in ASS precision atomically", () => {
    const state = load();
    for (const time of [0, 1, 1.001, NaN, Infinity, -1]) {
      expect(() => state.syncEnd(state.subtitles[0].id, time)).toThrow();
      expect(useSubtitleStore.getState()).toBe(state);
    }
  });
  it("preserves multiselection when setting End of a selected row", () => {
    const state = load();
    state.select(state.subtitles[0].id);
    state.select(state.subtitles[1].id, { toggle: true });
    state.syncEnd(state.subtitles[0].id, 2);
    expect(useSubtitleStore.getState().selectedIds).toEqual(state.subtitles.map((line) => line.id));
  });
});
