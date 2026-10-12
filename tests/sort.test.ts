import { describe, it, expect } from "vitest";
import { parseAss } from "../src/lib/assParser";
import { writeAss } from "../src/lib/assWriter";
import { useSubtitleStore } from "../src/store/subtitleStore";
const input =
  "[Script Info]\nTitle: Keep\n[Events]\nFormat: Start, End, Name, Text\nDialogue: 0:00:05.00,0:00:07.00,Late,Late text\nComment: 0:00:00.00,0:00:01.00,Note,Keep comment\nFormat: Text, Name, End, Start\nDialogue: Early,Early,0:00:03.00,0:00:01.00\n[Fonts]\nfontname: Keep font";
describe("start-time ordering", () => {
  it("sorts saved Dialogue while preserving custom formats, speakers and comments", () => {
    const doc = parseAss(input);
    const saved = writeAss(doc, doc.subtitles);
    const result = parseAss(saved);
    expect(result.subtitles.map((c) => c.start)).toEqual([1, 5]);
    expect(result.subtitles.map((c) => c.speaker)).toEqual(["Early", "Late"]);
    expect(result.subtitles.map((c) => c.text)).toEqual(["Early", "Late text"]);
    expect(saved).toContain("Comment: 0:00:00.00,0:00:01.00,Note,Keep comment");
    expect(saved).toContain("[Fonts]\nfontname: Keep font");
    expect(result.info.Title).toBe("Keep");
  });
  it("keeps equal-start lines stable", () => {
    const doc = parseAss(input);
    const cues = doc.subtitles.map((c) => ({ ...c, start: 1 }));
    expect(
      parseAss(writeAss(doc, cues)).subtitles.map((c) => c.speaker),
    ).toEqual(["Late", "Early"]);
  });
  it("sorts import, edit and added rows while keeping selection attached to IDs", () => {
    const s = useSubtitleStore.getState();
    s.load(parseAss(input), "sort.ass");
    expect(useSubtitleStore.getState().subtitles.map((c) => c.start)).toEqual([
      1, 5,
    ]);
    const early = useSubtitleStore.getState().subtitles[0];
    s.select(early.id);
    s.update(early.id, { start: 6, end: 8 });
    expect(useSubtitleStore.getState().subtitles.map((c) => c.start)).toEqual([
      5, 6,
    ]);
    expect(useSubtitleStore.getState().selectedIds).toEqual([early.id]);
    s.add(0);
    expect(useSubtitleStore.getState().subtitles.map((c) => c.start)).toEqual([
      0, 5, 6,
    ]);
  });
});
