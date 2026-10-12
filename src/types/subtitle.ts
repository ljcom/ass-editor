export interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
  style: string;
  speaker: string;
  fields: Record<string, string>;
}
export interface AssLine {
  raw: string;
  cueId?: string;
  format?: string[];
}
export interface AssDocument {
  lines: AssLine[];
  subtitles: Subtitle[];
  styles: Record<string, Record<string, string>>;
  info: Record<string, string>;
  format: string[];
  newline: string;
}
export interface DesktopAPI {
  burnVideo(url: string, content: string): Promise<{ name: string } | null>;
  cancelBurn(): void;
  onBurnProgress(callback: (seconds: number) => void): () => void;
  openVideo(): Promise<{ name: string; url: string } | null>;
  openSubtitle(): Promise<{ name: string; content: string } | null>;
  saveSubtitle(
    content: string,
    saveAs: boolean,
  ): Promise<{ name: string } | null>;
  setDirty(dirty: boolean): void;
  confirmReplace(): Promise<"save" | "discard" | "cancel">;
  onCloseRequest(callback: () => void): () => void;
  close(): void;
}
declare global {
  interface Window {
    desktop: DesktopAPI;
  }
}
