import { describe, it, expect } from "vitest";
import { matchesSubtitle } from "../src/lib/search";
import { parseAss } from "../src/lib/assParser";
import { writeAss } from "../src/lib/assWriter";
import { useSubtitleStore } from "../src/store/subtitleStore";
const doc = () =>
  parseAss(
    "[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,{\\c&H00FFFF&}Selamat {\\c&HFFFFFF&}pagi\nDialogue: 0:00:03.00,0:00:04.00,Other\nDialogue: 0:00:05.00,0:00:06.00,Selamat\\Nmalam",
  );
describe("subtitle search", () => {
  it("matches case-insensitive visible text across ASS color tags and escapes", () => {
    const cues = doc().subtitles;
    expect(matchesSubtitle(cues[0], " SELAMAT PAGI ")).toBe(true);
    expect(matchesSubtitle(cues[2], "selamat malam")).toBe(true);
    expect(matchesSubtitle(cues[0], "00FFFF")).toBe(false);
    expect(matchesSubtitle(cues[1], "selamat")).toBe(false);
  });
  it("matches Unicode text with normalization and an empty query shows all", () => {
    const cue = { ...doc().subtitles[0], text: "Café 世界" };
    expect(matchesSubtitle(cue, "CAFE\u0301")).toBe(true);
    expect(matchesSubtitle(cue, "世界")).toBe(true);
    expect(matchesSubtitle(cue, " ")).toBe(true);
  });
  it("filters selection without making edits or omitting rows from saved ASS", () => {
    const s = useSubtitleStore.getState();
    s.load(doc(), "search.ass");
    const before = useSubtitleStore.getState().subtitles;
    s.select(before[0].id);
    s.select(before[1].id, { toggle: true });
    s.setSearchQuery("selamat");
    const state = useSubtitleStore.getState();
    expect(state.selectedIds).toEqual([before[0].id]);
    expect(state.dirty).toBe(false);
    expect(state.subtitles).toBe(before);
    expect(
      parseAss(writeAss(state.document!, state.subtitles)).subtitles,
    ).toHaveLength(3);
  });
  it("Shift-select skips hidden rows and no-match search clears selection", () => {
    const s = useSubtitleStore.getState();
    s.load(doc(), "search.ass");
    const cues = useSubtitleStore.getState().subtitles;
    s.setSearchQuery("selamat");
    s.select(cues[0].id);
    s.select(cues[2].id, { range: true });
    expect(useSubtitleStore.getState().selectedIds).toEqual([
      cues[0].id,
      cues[2].id,
    ]);
    s.setSearchQuery("not found");
    expect(useSubtitleStore.getState().selectedIds).toEqual([]);
    s.setSearchQuery("");
    expect(useSubtitleStore.getState().subtitles).toHaveLength(3);
  });
  it("resets search when a new subtitle is loaded", () => {
    const s = useSubtitleStore.getState();
    s.setSearchQuery("old");
    s.load(doc(), "new.ass");
    expect(useSubtitleStore.getState().searchQuery).toBe("");
  });
});
