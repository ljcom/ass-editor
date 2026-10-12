import { describe, it, expect, beforeEach } from "vitest";
import { parseAss } from "../src/lib/assParser";
import { writeAss } from "../src/lib/assWriter";
import { parseTime, formatTime, validateTiming } from "../src/lib/timecode";
import { useSubtitleStore } from "../src/store/subtitleStore";
import { assColor, previewRuns } from "../src/lib/preview";
const fixture = `[Script Info]\nTitle: Unicode test\nPlayResX: 640\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour\nStyle: Default,Arial,32,&H00FFFFFF\nStyle: Other,Helvetica,24,&H000000FF\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nComment: 0,0:00:00.00,0:00:01.00,Default,,0000,0000,0000,,keep me\nDialogue: 0,0:00:01.20,0:00:03.50,Default,Thomas,0010,0020,0030,fx,{\\i1}Selamat, 世界\\Nhalo\\hThomas`;
describe("ASS preservation", () => {
  it("parses text commas, Unicode, overrides, metadata, styles and margins", () => {
    const d = parseAss(fixture);
    expect(d.subtitles[0]).toMatchObject({
      start: 1.2,
      end: 3.5,
      speaker: "Thomas",
      text: "{\\i1}Selamat, 世界\\Nhalo\\hThomas",
    });
    expect(d.subtitles[0].fields.marginl).toBe("0010");
    expect(Object.keys(d.styles)).toHaveLength(2);
    expect(d.info.Title).toBe("Unicode test");
  });
  it("uses custom column order including text in middle", () => {
    const d = parseAss(
      "[Events]\nFormat: End, Text, Name, Start, Style\nDialogue: 0:00:04.00,Hello, world,Jane,0:00:02.00,Other",
    );
    expect(d.subtitles[0]).toMatchObject({
      start: 2,
      end: 4,
      text: "Hello, world",
      speaker: "Jane",
      style: "Other",
    });
    expect(parseAss(writeAss(d, d.subtitles)).subtitles[0].text).toBe(
      "Hello, world",
    );
  });
  it("roundtrips supported metadata, non-dialogue events and tags", () => {
    const d = parseAss(fixture);
    const result = writeAss(d, d.subtitles);
    expect(result).toBe(fixture);
    expect(parseAss(result).subtitles[0].fields).toEqual(d.subtitles[0].fields);
  });
  it("preserves per-dialogue format changes", () => {
    const d = parseAss(
      fixture +
        "\nFormat: Text, End, Start\nDialogue: Hi, there,0:00:06.00,0:00:05.00",
    );
    expect(parseAss(writeAss(d, d.subtitles)).subtitles[1].text).toBe(
      "Hi, there",
    );
  });
  it("removes deleted dialogue and appends added rows in Events", () => {
    const d = parseAss(fixture + "\n[Fonts]\nfontname: keep");
    const cue = { ...d.subtitles[0], id: "new", text: "New" };
    const result = writeAss(d, [cue]);
    expect(result.indexOf(",,New")).toBeLessThan(result.indexOf("[Fonts]"));
    expect(parseAss(result).subtitles.map((s) => s.text)).toEqual(["New"]);
  });
  it("rejects malformed and invalid timing", () => {
    expect(() => parseAss("[Events]\nDialogue: bad")).toThrow();
    expect(() =>
      parseAss(fixture.replace("0:00:03.50", "0:00:00.50")),
    ).toThrow();
  });
});
describe("timing", () => {
  it("parses ASS and millisecond times", () => {
    expect(parseTime("1:02:03.45")).toBe(3723.45);
    expect(parseTime("00:01:02,123")).toBe(62.123);
  });
  it("rounds centiseconds with carry", () => {
    expect(formatTime(59.999, true)).toBe("0:01:00.00");
    expect(formatTime(1.234)).toBe("00:00:01.234");
  });
  it("prevents negative and invalid timestamps", () => {
    expect(() => validateTiming(-1, 1)).toThrow();
    expect(() => validateTiming(2, 2)).toThrow();
    expect(() => parseTime("00:61:00.00")).toThrow();
    expect(() => formatTime(NaN)).toThrow();
  });
  it("rejects duration lost at ASS precision", () => {
    const d = parseAss(fixture);
    expect(() =>
      writeAss(d, [{ ...d.subtitles[0], start: 1, end: 1.001 }]),
    ).toThrow();
  });
});
describe("editing", () => {
  beforeEach(() =>
    useSubtitleStore.getState().load(parseAss(fixture), "test.ass"),
  );
  it("adds and deletes selected subtitle", () => {
    const store = useSubtitleStore.getState();
    store.add(4);
    expect(useSubtitleStore.getState().subtitles).toHaveLength(2);
    store.remove();
    expect(useSubtitleStore.getState().subtitles).toHaveLength(1);
  });
  it("inserts a blank line after selection and preserves it on save", () => {
    const s = useSubtitleStore.getState();
    const original = s.subtitles[0];
    s.select(original.id);
    s.insert(0);
    const state = useSubtitleStore.getState();
    expect(state.subtitles[1]).toMatchObject({
      text: "",
      start: 3.5,
      end: 5.5,
      style: original.style,
    });
    expect(state.selected).toBe(state.subtitles[1].id);
    expect(state.dirty).toBe(true);
    state.update(state.selected!, { text: "Inserted text" });
    const result = parseAss(
      writeAss(state.document!, useSubtitleStore.getState().subtitles),
    );
    expect(result.subtitles.map((cue) => cue.text)).toEqual([
      original.text,
      "Inserted text",
    ]);
  });
  it("uses the gap before the next line and retains custom Format", () => {
    const doc = parseAss(
      "[Events]\nFormat: Text, End, Start, Style\nDialogue: First,0:00:02.00,0:00:01.00,Other\nDialogue: Next,0:00:04.00,0:00:03.00,Other",
    );
    const s = useSubtitleStore.getState();
    s.load(doc, "custom.ass");
    s.select(doc.subtitles[0].id);
    s.insert(0);
    const state = useSubtitleStore.getState();
    expect(state.subtitles[1]).toMatchObject({
      start: 2,
      end: 3,
      text: "",
      style: "Other",
    });
    expect(
      parseAss(writeAss(state.document!, state.subtitles)).subtitles.map(
        (c) => c.start,
      ),
    ).toEqual([1, 2, 3]);
  });
  it("inserts beside an overlapping line without invalid timing", () => {
    const s = useSubtitleStore.getState();
    s.add(2);
    s.select(s.subtitles[0].id);
    s.insert(0);
    expect(useSubtitleStore.getState().subtitles[1]).toMatchObject({
      start: 1.2,
      end: 3.5,
      text: "",
    });
  });
  it("inserts after an unsaved added row and selects a neighbor on delete", () => {
    const s = useSubtitleStore.getState();
    s.add(5);
    s.insert(0);
    const state = useSubtitleStore.getState();
    expect(
      parseAss(writeAss(state.document!, state.subtitles)).subtitles.map(
        (c) => c.start,
      ),
    ).toEqual([1.2, 5, 7]);
    state.remove();
    expect(useSubtitleStore.getState().selected).toBe(state.subtitles[1].id);
  });
  it("edits text and applies exact millisecond offset", () => {
    const s = useSubtitleStore.getState();
    const cue = s.subtitles[0];
    s.update(cue.id, { start: 1.21, end: 3.51, text: "Updated" });
    expect(useSubtitleStore.getState().subtitles[0]).toMatchObject({
      start: 1.21,
      end: 3.51,
      text: "Updated",
    });
    expect(useSubtitleStore.getState().dirty).toBe(true);
  });
  it("invalid edits do not mutate state and overlap is accepted", () => {
    const s = useSubtitleStore.getState();
    expect(() => s.update(s.subtitles[0].id, { start: -1 })).toThrow();
    expect(useSubtitleStore.getState().dirty).toBe(false);
    s.add(1.5);
    expect(useSubtitleStore.getState().subtitles).toHaveLength(2);
  });
});
describe("CSS preview", () => {
  it("renders inline primary colors in BGR order and resets to the style", () => {
    const runs = previewRuns(
      "{\\c&H00FFFF&}Yellow {\\1c&H0000FF&}Red {\\c&HFFFFFF&}White{\\r}Default",
    );
    expect(runs.map((run) => run.color)).toEqual([
      "rgba(255,255,0,1)",
      "rgba(255,0,0,1)",
      "rgba(255,255,255,1)",
      undefined,
    ]);
    expect(runs.map((run) => run.text)).toEqual([
      "Yellow ",
      "Red ",
      "White",
      "Default",
    ]);
  });
  it("applies color and formatting tags in order within a block", () => {
    expect(previewRuns("{\\r\\c&HFF0000&\\b1}Blue")[0]).toMatchObject({
      color: "rgba(0,0,255,1)",
      bold: true,
      text: "Blue",
    });
    expect(previewRuns("{\\c&H0000FF&\\r}Default")[0].color).toBeUndefined();
    expect(
      previewRuns("{\\c&H0000FF&}Red{\\1c}Default")[1].color,
    ).toBeUndefined();
  });
  it("keeps static color across escapes and ignores unsupported animated transforms", () => {
    const runs = previewRuns(
      "{\\c&H0000FF&}Red\\N{\\t(0,100,\\1c&HFF0000&)}Still red",
    );
    expect(runs.map((run) => run.color)).toEqual([
      "rgba(255,0,0,1)",
      "rgba(255,0,0,1)",
    ]);
    expect(runs[0].text).toBe("Red\n");
  });
  it("converts BGR with inverted alpha", () => {
    expect(assColor("&H000000FF")).toBe("rgba(255,0,0,1)");
    expect(assColor("&HFF00FF00")).toBe("rgba(0,255,0,0)");
  });
  it("renders escapes and basic overrides", () => {
    expect(previewRuns("{\\i1}Hello\\Nworld{\\i0}\\h!")).toEqual([
      { text: "Hello\nworld", bold: false, italic: true },
      { text: "\u00a0!", bold: false, italic: false },
    ]);
  });
});
