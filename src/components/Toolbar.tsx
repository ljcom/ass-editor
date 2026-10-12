export function Toolbar({
  name,
  dirty,
  videoName,
  onVideo,
  onSubtitle,
  onSave,
  canSave,
  canBurn,
  burning,
  onBurn,
}: {
  name: string;
  dirty: boolean;
  videoName: string;
  onVideo: () => void;
  onSubtitle: () => void;
  onSave: () => void;
  canSave: boolean;
  canBurn: boolean;
  burning: boolean;
  onBurn: () => void;
}) {
  return (
    <header>
      <div>
        <strong>Mini ASS Editor</strong>
        <span className="filename">
          {name}
          {dirty ? " *" : ""}
        </span>
      </div>
      <span className="video-name">{videoName}</span>
      <button onClick={onVideo}>Open Video</button>
      <button onClick={onSubtitle}>Open ASS</button>
      <button className="primary" disabled={!canSave} onClick={onSave}>
        Save ASS
      </button>
      <button disabled={!canBurn || burning} onClick={onBurn}>
        {burning ? "Burning…" : "Burn"}
      </button>
    </header>
  );
}
