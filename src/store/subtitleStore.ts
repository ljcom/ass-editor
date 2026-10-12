import { create } from "zustand";
import type { AssDocument, Subtitle } from "../types/subtitle";
import { formatTime, validateTiming } from "../lib/timecode";
import { rearrangeSubtitles } from "../lib/rearrange";
import { syncLineStart } from "../lib/syncStart";
import { matchesSubtitle } from "../lib/search";
interface State {
  document: AssDocument | null;
  subtitles: Subtitle[];
  name: string;
  dirty: boolean;
  selected: string | null;
  selectedIds: string[];
  selectionAnchor: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  load: (doc: AssDocument, name: string) => void;
  select: (id: string, options?: { toggle?: boolean; range?: boolean }) => void;
  update: (id: string, patch: Partial<Subtitle>) => void;
  syncStart: (id: string, time: number, videoDuration?: number) => void;
  syncEnd: (id: string, time: number) => void;
  add: (time: number) => void;
  insert: (time: number) => void;
  remove: () => void;
  rearrange: (
    ids: string[],
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number,
  ) => void;
  saved: (name: string) => void;
}
export const useSubtitleStore = create<State>((set, get) => ({
  document: null,
  subtitles: [],
  name: "No subtitle",
  dirty: false,
  selected: null,
  selectedIds: [],
  selectionAnchor: null,
  searchQuery: "",
  load: (document, name) =>
    set({
      document,
      subtitles: [...document.subtitles].sort((a, b) => a.start - b.start),
      name,
      dirty: false,
      selected: null,
      selectedIds: [],
      selectionAnchor: null,
      searchQuery: "",
    }),
  setSearchQuery: (searchQuery) => {
    const state = get();
    const selectedIds = state.selectedIds.filter((id) =>
      state.subtitles.some(
        (cue) => cue.id === id && matchesSubtitle(cue, searchQuery),
      ),
    );
    set({
      searchQuery,
      selectedIds,
      selected: selectedIds.includes(state.selected ?? "")
        ? state.selected
        : (selectedIds[selectedIds.length - 1] ?? null),
      selectionAnchor: selectedIds.includes(state.selectionAnchor ?? "")
        ? state.selectionAnchor
        : (selectedIds[0] ?? null),
    });
  },
  select: (id, options = {}) => {
    const state = get();
    if (
      !state.subtitles.some(
        (cue) => cue.id === id && matchesSubtitle(cue, state.searchQuery),
      )
    )
      return;
    if (options.range && state.selectionAnchor) {
      const sorted = state.subtitles
        .filter((cue) => matchesSubtitle(cue, state.searchQuery))
        .sort((a, b) => a.start - b.start);
      const from = sorted.findIndex((cue) => cue.id === state.selectionAnchor);
      const to = sorted.findIndex((cue) => cue.id === id);
      const ids = sorted
        .slice(Math.min(from, to), Math.max(from, to) + 1)
        .map((cue) => cue.id);
      set({
        selected: id,
        selectedIds: options.toggle
          ? [...new Set([...state.selectedIds, ...ids])]
          : ids,
      });
    } else if (options.toggle) {
      const ids = state.selectedIds.includes(id)
        ? state.selectedIds.filter((value) => value !== id)
        : [...state.selectedIds, id];
      set({
        selected: ids.includes(id) ? id : (ids[ids.length - 1] ?? null),
        selectedIds: ids,
        selectionAnchor: id,
      });
    } else set({ selected: id, selectedIds: [id], selectionAnchor: id });
  },
  update: (id, patch) => {
    if (patch.style !== undefined && /[,\r\n]/.test(patch.style)) {
      throw new Error(
        "Nama style tidak boleh mengandung koma atau baris baru.",
      );
    }
    const next = get().subtitles.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    );
    next.forEach((s) => validateTiming(s.start, s.end));
    set({ subtitles: next.sort((a, b) => a.start - b.start), dirty: true });
    if (get().searchQuery) get().setSearchQuery(get().searchQuery);
  },
  syncStart: (id, time, videoDuration) => {
    const subtitles = syncLineStart(get().subtitles, id, time, videoDuration);
    set({
      subtitles: subtitles.sort((a, b) => a.start - b.start),
      dirty: true,
      selected: id,
      selectedIds: get().selectedIds.includes(id) ? get().selectedIds : [id],
      selectionAnchor: get().selectedIds.includes(id)
        ? get().selectionAnchor
        : id,
    });
  },
  syncEnd: (id, time) => {
    const state = get();
    const cue = state.subtitles.find((line) => line.id === id);
    if (!cue) throw new Error("Baris subtitle tidak ditemukan.");
    const end = Math.floor(time * 1000 + 1e-6) / 1000;
    validateTiming(cue.start, end);
    if (formatTime(cue.start, true) === formatTime(end, true))
      throw new Error("Durasi terlalu pendek untuk presisi ASS (10 ms).");
    set({
      subtitles: state.subtitles.map((line) => line.id === id ? { ...line, end } : line),
      dirty: true,
      selected: id,
      selectedIds: state.selectedIds.includes(id) ? state.selectedIds : [id],
      selectionAnchor: state.selectedIds.includes(id) ? state.selectionAnchor : id,
    });
  },
  add: (time) => {
    const id = crypto.randomUUID();
    const format = get().document?.format ?? [];
    const fields = Object.fromEntries(
      format.map((k) => [
        k.toLowerCase(),
        k.toLowerCase().startsWith("margin")
          ? "0000"
          : k.toLowerCase() === "layer"
            ? "0"
            : "",
      ]),
    );
    set((s) => ({
      subtitles: [
        ...s.subtitles,
        {
          id,
          start: time,
          end: time + 2,
          text: "New subtitle",
          style: Object.keys(s.document?.styles ?? {})[0] ?? "Default",
          speaker: "",
          fields,
        },
      ].sort((a, b) => a.start - b.start),
      selected: id,
      selectedIds: [id],
      selectionAnchor: id,
      searchQuery: "",
      dirty: true,
    }));
  },
  insert: (time) => {
    const state = get();
    if (!state.document) return;
    const sorted = [...state.subtitles].sort((a, b) => a.start - b.start);
    const index = sorted.findIndex((cue) => cue.id === state.selected);
    const previous = sorted[index];
    const next = sorted[index + 1];
    const start = previous
      ? next && next.start <= previous.end
        ? previous.start
        : previous.end
      : time;
    const end =
      previous && start === previous.start
        ? previous.end
        : next && next.start > start
          ? Math.min(start + 2, next.start)
          : start + 2;
    validateTiming(start, end);
    const id = crypto.randomUUID();
    const cue: Subtitle = {
      id,
      start,
      end,
      text: "",
      style:
        previous?.style ?? Object.keys(state.document.styles)[0] ?? "Default",
      speaker: "",
      fields: previous
        ? { ...previous.fields, effect: "" }
        : { layer: "0", marginl: "0000", marginr: "0000", marginv: "0000" },
    };
    const subtitles = [...state.subtitles];
    const at = previous
      ? subtitles.findIndex((s) => s.id === previous.id) + 1
      : subtitles.length;
    subtitles.splice(at, 0, cue);
    const lines = [...state.document.lines];
    const anchor = previous
      ? lines.findIndex((line) => line.cueId === previous.id)
      : -1;
    if (anchor >= 0) {
      lines.splice(anchor + 1, 0, {
        raw: "",
        cueId: id,
        format: lines[anchor].format ?? state.document.format,
      });
    } else {
      // A row added earlier may not yet have a source line. Materialize it
      // alongside the inserted row so their order survives save/reopen.
      let position =
        lines.findIndex((line) => /^\s*\[events\]/i.test(line.raw)) + 1;
      while (position < lines.length && !/^\s*\[/.test(lines[position].raw))
        position++;
      lines.splice(
        position,
        0,
        { raw: "Format: " + state.document.format.join(", ") },
        ...(previous
          ? [{ raw: "", cueId: previous.id, format: state.document.format }]
          : []),
        { raw: "", cueId: id, format: state.document.format },
      );
    }
    set({
      document: { ...state.document, lines },
      subtitles: subtitles.sort((a, b) => a.start - b.start),
      selected: id,
      selectedIds: [id],
      selectionAnchor: id,
      searchQuery: "",
      dirty: true,
    });
  },
  remove: () =>
    set((s) => {
      const sorted = [...s.subtitles].sort((a, b) => a.start - b.start);
      const index = sorted.findIndex((cue) => cue.id === s.selected);
      if (index < 0) return s;
      const removed = new Set(s.selectedIds);
      const remaining = sorted.filter((cue) => !removed.has(cue.id));
      const neighbor =
        sorted.slice(index + 1).find((cue) => !removed.has(cue.id)) ??
        remaining[remaining.length - 1];
      return {
        subtitles: s.subtitles.filter((cue) => !removed.has(cue.id)),
        selected: neighbor?.id ?? null,
        selectedIds: neighbor ? [neighbor.id] : [],
        selectionAnchor: neighbor?.id ?? null,
        dirty: true,
      };
    }),
  saved: (name) => set({ name, dirty: false }),
  rearrange: (ids, oldStart, oldEnd, newStart, newEnd) => {
    const subtitles = rearrangeSubtitles(
      get().subtitles,
      ids,
      oldStart,
      oldEnd,
      newStart,
      newEnd,
    );
    set({
      subtitles: subtitles.sort((a, b) => a.start - b.start),
      dirty: true,
    });
  },
}));
