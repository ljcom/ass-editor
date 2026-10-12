import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function assertDifferentFile(output: string, sources: string[]) {
  const target = await stat(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!target) return;
  for (const source of sources) {
    const original = await stat(source);
    if (original.dev === target.dev && original.ino === target.ino)
      throw new Error("Pilih file MP4 baru; video dan ASS sumber tidak boleh ditimpa.");
  }
}

export async function burnVideo(options: {
  ffmpeg: string;
  video: string;
  content: string;
  output: string;
  signal: AbortSignal;
  onProgress: (seconds: number) => void;
}) {
  const { ffmpeg, video, content, output, signal, onProgress } = options;
  signal.throwIfAborted();
  const temporary = await mkdtemp(join(dirname(output), ".ass-burn-"));
  try {
    await writeFile(join(temporary, "subtitles.ass"), content, "utf8");
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      // A fixed relative ASS filename avoids FFmpeg filter escaping for paths.
      const child = spawn(ffmpeg, [
        "-hide_banner", "-nostdin", "-y", "-i", video,
        "-map", "0:v:0", "-map", "0:a?",
        "-vf", "ass=subtitles.ass", "-c:v", "libx264",
        "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        "-progress", "pipe:1", "-nostats", "output.mp4",
      ], { cwd: temporary, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "", pending = "";
      const abort = () => child.kill("SIGKILL");
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-6000);
      });
      child.stdout.on("data", (chunk: Buffer) => {
        pending += chunk.toString();
        const lines = pending.split(/\r?\n/);
        pending = lines.pop()!;
        for (const line of lines) {
          if (line.startsWith("out_time_us=")) {
            const seconds = Number(line.slice(12)) / 1_000_000;
            if (Number.isFinite(seconds)) onProgress(Math.max(0, seconds));
          }
        }
      });
      child.on("error", (error) => {
        signal.removeEventListener("abort", abort);
        reject(new Error(`FFmpeg tidak dapat dijalankan: ${error.message}`));
      });
      child.on("close", (code) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) reject(signal.reason);
        else if (code === 0) resolve();
        else reject(new Error(`Burn gagal: ${stderr.trim() || `FFmpeg exit ${code}`}`));
      });
    });
    signal.throwIfAborted();
    // Publish only a completed MP4; failed/cancelled burns leave no partial file.
    await assertDifferentFile(output, [video]);
    await rename(join(temporary, "output.mp4"), output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
