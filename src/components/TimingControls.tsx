import { useSubtitleStore } from "../store/subtitleStore";
import { useState } from "react";
import { RearrangeDialog } from "./RearrangeDialog";
export function TimingControls({
  time,
  onError,
  onSaveAs,
}: {
  time: number;
  onError: (message: string) => void;
  onSaveAs: () => void;
}) {
  const { document, selected, subtitles, update, add, insert, remove } =
    useSubtitleStore();
  const cue = subtitles.find((s) => s.id === selected);
  const [rearranging, setRearranging] = useState(false);
  const action = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      onError((e as Error).message);
    }
  };
  return (
    <footer>
      <button disabled={!document} onClick={() => add(time)}>
        ＋ Add
      </button>
      <button
        disabled={!document}
        title="Insert a blank subtitle after the selected line"
        onClick={() => action(() => insert(time))}
      >
        Insert Line
      </button>
      <button disabled={!cue} onClick={remove}>
        Delete Line
      </button>
      <span className="divider" />
      <button
        disabled={!cue}
        onClick={() => action(() => update(cue!.id, { start: time }))}
      >
        Set Start
      </button>
      <button
        disabled={!cue}
        onClick={() => action(() => update(cue!.id, { end: time }))}
      >
        Set End
      </button>
      <span className="muted">Shift</span>
      {[-1000, -100, -10, 10, 100, 1000].map((ms) => (
        <button
          key={ms}
          disabled={!cue}
          onClick={() =>
            action(() =>
              update(cue!.id, {
                start: Math.round((cue!.start + ms / 1000) * 1000) / 1000,
                end: Math.round((cue!.end + ms / 1000) * 1000) / 1000,
              }),
            )
          }
        >
          {ms > 0 ? "+" : ""}
          {ms}
        </button>
      ))}
      <span className="spacer" />
      <button disabled={!subtitles.length} onClick={() => setRearranging(true)}>
        Rearrange
      </button>
      <button disabled={!document} onClick={onSaveAs}>
        Save As…
      </button>
      {rearranging && <RearrangeDialog onClose={() => setRearranging(false)} />}
    </footer>
  );
}
