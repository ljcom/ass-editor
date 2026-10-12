import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { videoResponse } from "../electron/media";
let folder: string, path: string;
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "ass-range-"));
  path = join(folder, "video.mp4");
  await writeFile(path, "0123456789");
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});
const request = (range?: string, method = "GET") =>
  new Request("media://test/video", {
    method,
    headers: range ? { Range: range } : {},
  });
describe("local video seeking", () => {
  it("serves full file and advertises byte ranges", async () => {
    const result = await videoResponse(request(), path);
    expect(result.status).toBe(200);
    expect(result.headers.get("accept-ranges")).toBe("bytes");
    expect(await result.text()).toBe("0123456789");
  });
  it("serves exact partial content for a seek", async () => {
    const result = await videoResponse(request("bytes=4-7"), path);
    expect(result.status).toBe(206);
    expect(result.headers.get("content-range")).toBe("bytes 4-7/10");
    expect(result.headers.get("content-length")).toBe("4");
    expect(await result.text()).toBe("4567");
  });
  it("handles open and suffix ranges", async () => {
    expect(await (await videoResponse(request("bytes=7-"), path)).text()).toBe(
      "789",
    );
    expect(await (await videoResponse(request("bytes=-3"), path)).text()).toBe(
      "789",
    );
  });
  it("rejects invalid or unsatisfiable ranges", async () => {
    for (const range of [
      "bytes=20-",
      "bytes=4-2",
      "bytes=-0",
      "invalid",
      "bytes=0-1,4-5",
    ]) {
      const result = await videoResponse(request(range), path);
      expect(result.status).toBe(416);
      expect(result.headers.get("content-range")).toBe("bytes */10");
    }
  });
  it("supports HEAD without streaming the file", async () => {
    const result = await videoResponse(request("bytes=2-5", "HEAD"), path);
    expect(result.status).toBe(206);
    expect(result.headers.get("content-length")).toBe("4");
    expect(await result.text()).toBe("");
  });
});
