import { useSubtitleStore } from "../store/subtitleStore";
import { previewRuns, styleCss } from "../lib/preview";
export function SubtitleOverlay({
  time,
  width,
}: {
  time: number;
  width: number;
}) {
  const { subtitles, document } = useSubtitleStore();
  const resolution = Number(document?.info.PlayResX) || width || 640;
  return (
    <div className="overlay" aria-hidden="true">
      {subtitles
        .filter((s) => s.start <= time && time < s.end)
        .map((cue) => {
          const style = document?.styles[cue.style];
          const align = Number(style?.alignment) || 2;
          const row = Math.ceil(align / 3);
          const col = (align - 1) % 3;
          return (
            <div
              key={cue.id}
              className="subtitle-preview"
              style={{
                ...styleCss(style, width / resolution),
                top: row === 3 ? "5%" : row === 2 ? "45%" : undefined,
                bottom: row === 1 ? "6%" : undefined,
                left: col === 0 ? "4%" : col === 1 ? "50%" : undefined,
                right: col === 2 ? "4%" : undefined,
                transform: col === 1 ? "translateX(-50%)" : undefined,
                textAlign: col === 0 ? "left" : col === 2 ? "right" : "center",
              }}
            >
              {previewRuns(cue.text).map((run, i) => (
                <span
                  key={i}
                  style={{
                    color: run.color,
                    fontWeight: run.bold ? "bold" : undefined,
                    fontStyle: run.italic ? "italic" : undefined,
                  }}
                >
                  {run.text}
                </span>
              ))}
            </div>
          );
        })}
    </div>
  );
}
