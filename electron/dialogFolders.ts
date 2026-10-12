import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";

type Kind = "video" | "subtitle" | "save";
const kinds: Kind[] = ["video", "subtitle", "save"];

export class DialogFolders {
  private folders: Partial<Record<Kind, string>> = {};
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly settingsFile: string) {}

  async load(): Promise<void> {
    try {
      const value: unknown = JSON.parse(
        await readFile(this.settingsFile, "utf8"),
      );
      if (!value || typeof value !== "object") return;
      for (const kind of kinds) {
        const path = (value as Record<string, unknown>)[kind];
        if (typeof path === "string" && isAbsolute(path))
          this.folders[kind] = path;
      }
    } catch {
      // Missing or malformed preferences must not prevent app startup.
    }
  }

  async folder(kind: Kind): Promise<string | undefined> {
    const fallbacks: Record<Kind, Kind[]> = {
      video: ["video", "subtitle", "save"],
      subtitle: ["subtitle", "video", "save"],
      save: ["save", "subtitle", "video"],
    };
    for (const candidate of fallbacks[kind]) {
      const path = this.folders[candidate];
      if (
        path &&
        (await stat(path)
          .then((value) => value.isDirectory())
          .catch(() => false))
      )
        return path;
    }
    return undefined;
  }

  async savePath(currentFile?: string): Promise<string> {
    const folder = await this.folder("save");
    const filename = currentFile
      ? basename(currentFile).replace(/\.ssa$/i, ".ass")
      : "subtitles.ass";
    return folder
      ? join(folder, filename)
      : (currentFile?.replace(/\.ssa$/i, ".ass") ?? filename);
  }

  async remember(kind: Kind, file: string): Promise<void> {
    this.folders[kind] = dirname(file);
    this.writes = this.writes
      .then(async () => {
        await mkdir(dirname(this.settingsFile), { recursive: true });
        const temporaryFile = this.settingsFile + ".tmp";
        await writeFile(
          temporaryFile,
          JSON.stringify(this.folders, null, 2),
          "utf8",
        );
        await rename(temporaryFile, this.settingsFile);
      })
      .catch((error) => {
        // The file operation already succeeded; a preferences failure must not
        // report it as failed or leave the document pointing at the old file.
        console.warn(
          "Could not remember dialog folder:",
          (error as Error).message,
        );
      });
    await this.writes;
  }
}
