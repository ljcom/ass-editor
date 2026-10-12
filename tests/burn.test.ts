import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, readdir, rm, link } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { assertDifferentFile, burnVideo } from "../electron/burn";

const content = `[Script Info]
ScriptType: v4.00+
PlayResX: 320
PlayResY: 180
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,30,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,{\\c&H00FFFF&}BURN TEST
`;
let directory: string, video: string, original: Buffer;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "burn ' unicode 世界-"));
  video = join(directory, "source ' 世界.mp4");
  execFileSync(ffmpeg!, [
    "-v", "error", "-f", "lavfi", "-i", "color=black:s=320x180:d=2:r=12",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", video,
  ]);
  original = await readFile(video);
}, 20000);
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

describe("burn ASS into MP4", () => {
  it("renders inline colors, retains audio and leaves the source intact", async () => {
    const output = join(directory, "burned 世界.mp4");
    const progress: number[] = [];
    await burnVideo({ ffmpeg: ffmpeg!, video, content, output,
      signal: new AbortController().signal, onProgress: (seconds) => progress.push(seconds) });
    const frame = execFileSync(ffmpeg!, [
      "-v", "error", "-ss", "0.5", "-i", output,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
    ]);
    expect(frame.length).toBe(320 * 180 * 3);
    let yellow = 0;
    for (let i = 0; i < frame.length; i += 3)
      if (frame[i] > 150 && frame[i + 1] > 150 && frame[i + 2] < 80) yellow++;
    expect(yellow).toBeGreaterThan(100);
    const audio = execFileSync(ffmpeg!, [
      "-v", "error", "-i", output, "-vn", "-f", "s16le", "pipe:1",
    ]);
    expect(audio.length).toBeGreaterThan(1000);
    expect(await readFile(video)).toEqual(original);
    expect(progress.length).toBeGreaterThan(0);
    expect((await readdir(directory)).some((name) => name.startsWith(".ass-burn-"))).toBe(false);
  }, 20000);
  it("protects the source and hard-link aliases from overwrite", async () => {
    const alias = join(directory, "alias.mp4");
    await link(video, alias);
    await expect(assertDifferentFile(video, [video])).rejects.toThrow("sumber");
    await expect(assertDifferentFile(alias, [video])).rejects.toThrow("sumber");
  });
  it("leaves an existing destination untouched when encoding fails", async () => {
    const output = join(directory, "keep.mp4");
    await writeFile(output, "existing output");
    await expect(burnVideo({ ffmpeg: ffmpeg!, video: join(directory, "missing.mp4"),
      content, output, signal: new AbortController().signal, onProgress: () => {} })).rejects.toThrow("Burn gagal");
    expect(await readFile(output, "utf8")).toBe("existing output");
    expect((await readdir(directory)).some((name) => name.startsWith(".ass-burn-"))).toBe(false);
  });
  it("cancels an active burn and removes its partial output", async () => {
    const output = join(directory, "cancelled.mp4");
    const controller = new AbortController();
    await expect(burnVideo({ ffmpeg: ffmpeg!, video, content, output,
      signal: controller.signal, onProgress: () => controller.abort() })).rejects.toThrow();
    expect(await readdir(directory)).not.toContain("cancelled.mp4");
    expect((await readdir(directory)).some((name) => name.startsWith(".ass-burn-"))).toBe(false);
    expect(await readFile(video)).toEqual(original);
  }, 20000);
});
