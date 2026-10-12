const { Arch } = require("builder-util");
const { mkdir, copyFile, chmod, readFile, stat, rm } = require("node:fs/promises");
const { createWriteStream } = require("node:fs");
const { join } = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { createGunzip } = require("node:zlib");

// Always package the target binary, including cross-builds from another OS/CPU.
module.exports = async (context) => {
  const platform = context.electronPlatformName;
  const arch = Arch[context.arch];
  const executable = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const resources = platform === "darwin"
    ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : join(context.appOutDir, "resources");
  const destination = join(resources, "ffmpeg");
  await mkdir(destination, { recursive: true });
  const pkgDir = join(context.packager.projectDir, "node_modules", "ffmpeg-static");
  if (platform === process.platform && arch === process.arch) {
    const source = require("ffmpeg-static");
    await copyFile(source, join(destination, executable));
    for (const suffix of ["README", "LICENSE"])
      await copyFile(`${source}.${suffix}`, join(destination, `${executable}.${suffix}`));
  } else {
    const pkg = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
    const release = pkg["ffmpeg-static"]["binary-release-tag"];
    const base = `https://github.com/eugeneware/ffmpeg-static/releases/download/${release}`;
    const cache = join(context.packager.projectDir, ".ffmpeg-cache", release, `${platform}-${arch}`);
    await mkdir(cache, { recursive: true });
    for (const suffix of ["", ".README", ".LICENSE"]) {
      const cached = join(cache, executable + suffix);
      if (!(await stat(cached).catch(() => null))) {
        const name = suffix ? `${platform}-${arch}${suffix}` : `ffmpeg-${platform}-${arch}.gz`;
        const response = await fetch(`${base}/${name}`);
        if (!response.ok) throw new Error(`FFmpeg download failed: ${response.status} ${name}`);
        const partial = cached + ".tmp";
        try {
          const input = Readable.fromWeb(response.body);
          if (suffix) await pipeline(input, createWriteStream(partial));
          else await pipeline(input, createGunzip(), createWriteStream(partial));
          await require("node:fs/promises").rename(partial, cached);
        } finally {
          await rm(partial, { force: true });
        }
      }
      await copyFile(cached, join(destination, executable + suffix));
    }
  }
  await chmod(join(destination, executable), 0o755);
};
