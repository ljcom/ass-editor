import { beforeEach, describe, it, expect } from "vitest";
import { useSubtitleStore } from "../src/store/subtitleStore";
import { parseAss } from "../src/lib/assParser";
const document = () =>
  parseAss(
    "[Events]\nFormat: Start, End, Text\nDialogue: 0:00:05.00,0:00:06.00,Last\nDialogue: 0:00:01.00,0:00:02.00,First\nDialogue: 0:00:03.00,0:00:04.00,Middle",
  );
beforeEach(() => useSubtitleStore.getState().load(document(), "selection.ass"));
describe("subtitle multi-selection", () => {
  it("toggles non-adjacent lines without modifying subtitles or dirty state", () => {
    const s = useSubtitleStore.getState();
    s.select(s.subtitles[1].id);
    s.select(s.subtitles[0].id, { toggle: true });
    expect(useSubtitleStore.getState().selectedIds).toEqual([
      s.subtitles[1].id,
      s.subtitles[0].id,
    ]);
    s.select(s.subtitles[0].id, { toggle: true });
    expect(useSubtitleStore.getState().selectedIds).toEqual([
      s.subtitles[1].id,
    ]);
    expect(useSubtitleStore.getState().dirty).toBe(false);
  });
  it("extends from a fixed anchor using table chronological order", () => {
    const s = useSubtitleStore.getState();
    s.select(s.subtitles[0].id);
    s.select(s.subtitles[2].id, { range: true });
    expect(useSubtitleStore.getState().selectedIds).toEqual(
      s.subtitles.map((c) => c.id),
    );
    s.select(s.subtitles[1].id, { range: true });
    expect(useSubtitleStore.getState().selectedIds).toEqual(
      s.subtitles.slice(0, 2).map((c) => c.id),
    );
  });
  it("plain click replaces selection and reloading clears it", () => {
    const s = useSubtitleStore.getState();
    s.select(s.subtitles[1].id);
    s.select(s.subtitles[0].id, { toggle: true });
    s.select(s.subtitles[2].id);
    expect(useSubtitleStore.getState().selectedIds).toEqual([
      s.subtitles[2].id,
    ]);
    s.load(document(), "reloaded.ass");
    expect(useSubtitleStore.getState().selectedIds).toEqual([]);
    expect(useSubtitleStore.getState().selectionAnchor).toBeNull();
  });
  it("rearranges exactly selected IDs, preserving unselected lines between them", () => {
    const s = useSubtitleStore.getState();
    s.select(s.subtitles[0].id);
    s.select(s.subtitles[2].id, { toggle: true });
    const state = useSubtitleStore.getState();
    state.rearrange(state.selectedIds, 1, 6, 10, 20);
    const result = useSubtitleStore.getState();
    expect(
      result.subtitles.find((c) => c.id === s.subtitles[0].id)!.start,
    ).toBe(10);
    expect(result.subtitles.find((c) => c.id === s.subtitles[2].id)!.end).toBe(
      20,
    );
    expect(result.subtitles.find((c) => c.id === s.subtitles[1].id)).toBe(
      s.subtitles[1],
    );
    expect(result.selectedIds).toEqual(state.selectedIds);
  });
  it("deletes selected rows together and selects a surviving neighbor", () => {
    const s = useSubtitleStore.getState();
    s.select(s.subtitles[1].id);
    s.select(s.subtitles[0].id, { toggle: true });
    s.remove();
    expect(useSubtitleStore.getState().subtitles).toEqual([s.subtitles[2]]);
    expect(useSubtitleStore.getState().selectedIds).toEqual([
      s.subtitles[2].id,
    ]);
  });
});
