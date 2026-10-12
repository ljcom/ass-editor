import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";

// Chromium seeks by requesting byte ranges. Serve only the path authorized by
// the main process; no renderer-provided filesystem path is accepted here.
export async function videoResponse(
  request: Request,
  path: string,
): Promise<Response> {
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405 });
  const { size } = await stat(path);
  const mime: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  const headers = new Headers({
    "Content-Type":
      mime[extname(path).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
  });
  const range = request.headers.get("range");
  let start = 0,
    end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else start = Math.max(0, size - Number(match[2]));
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= size
    )
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(Math.max(0, end - start + 1)));
  if (request.method === "HEAD" || size === 0)
    return new Response(null, { status: range ? 206 : 200, headers });
  const stream = createReadStream(path, { start, end });
  const abort = () => stream.destroy();
  request.signal.addEventListener("abort", abort, { once: true });
  stream.once("close", () =>
    request.signal.removeEventListener("abort", abort),
  );
  if (request.signal.aborted) stream.destroy();
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: range ? 206 : 200,
    headers,
  });
}
