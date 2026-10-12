export function Toolbar({
  name,
  dirty,
  videoName,
  onVideo,
  onSubtitle,
  onSave,
  canSave,
}: {
  name: string;
  dirty: boolean;
  videoName: string;
  onVideo: () => void;
  onSubtitle: () => void;
  onSave: () => void;
  canSave: boolean;
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
    </header>
  );
}
