import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DialogFolders } from "../electron/dialogFolders";
let root: string,
  settings: string,
  video: string,
  subtitle: string,
  save: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ass-folders-"));
  settings = join(root, "preferences", "folders.json");
  video = join(root, "video");
  subtitle = join(root, "subtitle");
  save = join(root, "save");
  await Promise.all([video, subtitle, save].map((path) => mkdir(path)));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe("last dialog folders", () => {
  it("starts without preferences and keeps the current filename", async () => {
    const folders = new DialogFolders(settings);
    await folders.load();
    expect(await folders.folder("video")).toBeUndefined();
    expect(await folders.savePath()).toBe("subtitles.ass");
    expect(await folders.savePath(join(subtitle, "song.ssa"))).toBe(
      join(subtitle, "song.ass"),
    );
  });
  it("remembers distinct folders across application restarts", async () => {
    const folders = new DialogFolders(settings);
    await Promise.all([
      folders.remember("video", join(video, "song.mp4")),
      folders.remember("subtitle", join(subtitle, "song.ass")),
      folders.remember("save", join(save, "output.ass")),
    ]);
    const reloaded = new DialogFolders(settings);
    await reloaded.load();
    expect(await reloaded.folder("video")).toBe(video);
    expect(await reloaded.folder("subtitle")).toBe(subtitle);
    expect(await reloaded.folder("save")).toBe(save);
    expect(await reloaded.savePath(join(subtitle, "song.ssa"))).toBe(
      join(save, "song.ass"),
    );
  });
  it("uses another remembered folder for the first open or save", async () => {
    const folders = new DialogFolders(settings);
    await folders.remember("video", join(video, "movie.mp4"));
    expect(await folders.folder("subtitle")).toBe(video);
    await folders.remember("subtitle", join(subtitle, "song.ass"));
    expect(await folders.savePath(join(subtitle, "song.ass"))).toBe(
      join(subtitle, "song.ass"),
    );
  });
  it("falls back when a remembered directory has been removed", async () => {
    const folders = new DialogFolders(settings);
    await folders.remember("save", join(save, "song.ass"));
    await folders.remember("subtitle", join(subtitle, "song.ass"));
    await rm(save, { recursive: true });
    expect(await folders.folder("save")).toBe(subtitle);
  });
  it("ignores malformed preferences and invalid paths", async () => {
    await mkdir(join(root, "preferences"));
    await writeFile(settings, "bad json");
    const folders = new DialogFolders(settings);
    await folders.load();
    expect(await folders.folder("video")).toBeUndefined();
    await writeFile(
      settings,
      JSON.stringify({ video: 42, subtitle: "relative/path", save: root }),
    );
    await folders.load();
    expect(await folders.folder("save")).toBe(root);
  });
});
