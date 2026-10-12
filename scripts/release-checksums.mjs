import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const directory = "release";
const files = (await readdir(directory))
  .filter((file) => /^Mini-ASS-Editor-.*\.(exe|dmg|zip)$/.test(file))
  .sort();
if (!files.length)
  throw new Error("No release packages found. Build the packages first.");
const lines = [];
for (const file of files) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(directory, file)))
    hash.update(chunk);
  lines.push(`${hash.digest("hex")}  ${file}`);
}
await writeFile(join(directory, "SHA256SUMS.txt"), lines.join("\n") + "\n");
console.log(`Wrote SHA256SUMS.txt for ${files.length} packages.`);
