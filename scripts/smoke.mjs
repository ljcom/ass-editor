import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const temp = await mkdtemp(join(tmpdir(), "mini-ass-"));
const ass = join(temp, "fixture.ass"),
  output = join(temp, "saved.ass"),
  burned = join(temp, "burned.mp4"),
  video = join(temp, "video.mp4");
await writeFile(
  ass,
  "[Script Info]\nTitle: Smoke test\nPlayResX: 640\nPlayResY: 360\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, Alignment, Outline\nStyle: Default,Arial,32,&H00FFFFFF,2,2\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:00.20,0:00:02.00,Default,,0000,0000,0000,,Hello, world",
);
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x182030:s=640x360:d=3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    video,
  ],
  { stdio: "ignore" },
);
const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;
// Isolate persisted dialog folders from the user's actual preferences.
const userData = join(temp, "app-data");
await mkdir(userData);
const launcher = join(temp, "launch.cjs");
await writeFile(
  launcher,
  `const { app } = require('electron');\napp.setPath('userData', ${JSON.stringify(userData)});\nrequire(${JSON.stringify(resolve("dist-electron/main.cjs"))});\n`,
);
const app = await electron.launch({ args: [launcher], env: childEnv });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(
    ({ dialog }, paths) => {
      dialog.showOpenDialog = async (_win, options) => ({
        canceled: false,
        filePaths: [
          options.filters[0].name === "Video" ? paths.video : paths.ass,
        ],
      });
      dialog.showSaveDialog = async (_win, options) => ({
        canceled: false,
        filePath: options.filters[0].name === "MP4 video" ? paths.burned : paths.output,
      });
      dialog.showMessageBox = async () => ({
        response: 2,
        checkboxChecked: false,
      });
    },
    { ass, video, output, burned },
  );
  await expect(page.getByRole("button", { name: "Burn", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Open Video", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("video").readyState >= 2,
  );
  const slider = page.getByRole("slider", { name: "Seek video", exact: true });
  const sliderBounds = await slider.boundingBox();
  await page.evaluate(() => document.querySelector("video").play());
  const sliderY = sliderBounds.y + sliderBounds.height / 2;
  await page.mouse.move(sliderBounds.x + sliderBounds.width * 0.2, sliderY);
  await page.mouse.down();
  await page.mouse.move(sliderBounds.x + sliderBounds.width * 0.8, sliderY, {
    steps: 8,
  });
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(2.2);
  // Playback time advances while the thumb is held; the chosen position stays.
  await page.waitForTimeout(250);
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(2.2);
  await page.mouse.up();
  await page.evaluate(() => document.querySelector("video").pause());
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector("video").currentTime),
    )
    .toBeGreaterThan(2.2);
  await page.evaluate(() => {
    document.querySelector("video").dispatchEvent(new Event("timeupdate"));
  });
  await expect
    .poll(async () => Number(await slider.inputValue()))
    .toBeGreaterThan(2.2);
  await page.getByRole("button", { name: "Open ASS", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.locator(".text-cell").click();
  await expect(page.locator(".subtitle-preview")).toHaveText("Hello, world");
  await page.locator(".text-cell").dblclick();
  await page
    .getByRole("textbox", { name: "Edit text" })
    .fill("{\\c&H00FFFF&}Yellow {\\1c&H0000FF&}Red");
  await page.getByRole("textbox", { name: "Edit text" }).press("Enter");
  await expect(page.locator(".subtitle-preview span").nth(0)).toHaveCSS(
    "color",
    "rgb(255, 255, 0)",
  );
  await expect(page.locator(".subtitle-preview span").nth(1)).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await page.locator(".text-cell").dblclick();
  const textEditor = page.getByRole("textbox", { name: "Edit text" });
  const wrappedText =
    "A long subtitle with words that should wrap inside the text column. ".repeat(
      8,
    );
  await textEditor.fill(wrappedText);
  expect(await textEditor.evaluate((element) => element.tagName)).toBe(
    "TEXTAREA",
  );
  expect(
    await textEditor.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await textEditor.press("End");
  await textEditor.press("Shift+Enter");
  await expect(textEditor).toHaveValue(wrappedText + "\n");
  await textEditor.press("Enter");
  await expect(textEditor).toHaveCount(0);
  await page.locator(".text-cell").dblclick();
  await page.getByRole("textbox", { name: "Edit text" }).fill("Edited, 世界");
  await page.getByRole("textbox", { name: "Edit text" }).press("Enter");
  await expect(page.locator(".filename")).toContainText("*");
  const beforeBurnName = await page.locator(".filename").textContent();
  const beforeBurnAss = await readFile(ass, "utf8");
  await page.getByRole("button", { name: "Burn", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Burn selesai: burned.mp4", { timeout: 30000 });
  await expect(page.locator(".filename")).toHaveText(beforeBurnName);
  expect(await readFile(ass, "utf8")).toBe(beforeBurnAss);
  execFileSync("ffmpeg", ["-v", "error", "-i", burned, "-f", "null", "-"], { stdio: "ignore" });
  await page.locator("tbody tr td").nth(1).locator(".line-time").dblclick();
  await page.getByRole("textbox", { name: "Edit start" }).fill("00:00:00.300");
  await page.getByRole("textbox", { name: "Edit start" }).press("Enter");
  await page.getByRole("button", { name: "Save As…", exact: true }).click();
  await expect(page.locator(".filename")).toHaveText("saved.ass");
  const saved = await readFile(output, "utf8");
  expect(saved).toContain("0:00:00.30,0:00:02.00");
  expect(saved).toContain("Edited, 世界");
  await page.locator(".text-cell").dblclick();
  await page.getByRole("textbox", { name: "Edit text" }).fill("Cancel this");
  await page.getByRole("textbox", { name: "Edit text" }).press("Escape");
  await expect(page.locator(".text-cell")).toHaveText("Edited, 世界");
  await page.getByRole("button", { name: "＋ Add", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  const search = page.getByRole("searchbox", { name: "Search subtitles" });
  await search.fill("EDITED");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator(".text-cell")).toHaveText("Edited, 世界");
  await search.fill("no such subtitle");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await expect(
    page.getByText("Tidak ada subtitle yang cocok dengan pencarian."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Open ASS", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  const rows = page.locator("tbody tr");
  await rows.nth(0).locator("td").nth(0).click();
  await rows
    .nth(1)
    .locator("td")
    .nth(0)
    .click({ modifiers: ["Meta"] });
  await expect(page.locator('tbody tr[aria-selected="true"]')).toHaveCount(2);
  const starts = await rows
    .locator("td:nth-child(2) .line-time")
    .allTextContents();
  const ends = await rows.locator("td:nth-child(3)").allTextContents();
  await page.getByRole("button", { name: "Rearrange", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Rearrange scope" }),
  ).toHaveValue("selected");
  await expect(
    page.getByRole("textbox", { name: "Original start", exact: true }),
  ).toHaveValue(starts.sort()[0]);
  await expect(
    page.getByRole("textbox", { name: "Original end", exact: true }),
  ).toHaveValue(ends.sort().at(-1));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await rows
    .nth(1)
    .locator("td")
    .nth(0)
    .click({ modifiers: ["Meta"] });
  await expect(page.locator('tbody tr[aria-selected="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Rearrange", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Rearrange scope" }),
  ).toHaveValue("selected");
  await expect(
    page.getByRole("textbox", { name: "Original start", exact: true }),
  ).toHaveValue("00:00:00.300");
  await expect(
    page.getByRole("textbox", { name: "Original end", exact: true }),
  ).toHaveValue("00:00:02.000");
  await page
    .getByRole("textbox", { name: "New start", exact: true })
    .fill("00:01");
  await page
    .getByRole("textbox", { name: "New end", exact: true })
    .fill("00:02");
  await page.getByRole("button", { name: "Apply Timing", exact: true }).click();
  await expect(
    page
      .locator("tbody tr")
      .filter({ hasText: "Edited, 世界" })
      .locator("td")
      .nth(1)
      .locator(".line-time"),
  ).toHaveText("00:00:01.000");
  await expect(
    page
      .locator("tbody tr")
      .filter({ hasText: "Edited, 世界" })
      .locator("td")
      .nth(2),
  ).toHaveText("00:00:02.000");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.evaluate(() => {
    document.querySelector("video").currentTime = 1.5;
  });
  await page.waitForFunction(() => !document.querySelector("video").seeking);
  const editedRow = page
    .locator("tbody tr")
    .filter({ hasText: "Edited, 世界" });
  await editedRow.getByRole("button", { name: /Set start line/ }).click();
  await expect(editedRow.locator("td").nth(1).locator(".line-time")).toHaveText(
    "00:00:01.500",
  );
  await expect(
    page.locator("tbody tr").first().locator("td").nth(2),
  ).toHaveText("00:00:01.400");
  expect(
    await page.evaluate(() => document.querySelector("video").currentTime),
  ).toBe(1.5);
  await page.evaluate(() => { document.querySelector("video").currentTime = 1.8; });
  await page.waitForFunction(() => !document.querySelector("video").seeking);
  await editedRow.getByRole("button", { name: /Set end line/ }).click();
  await expect(editedRow.locator(".line-time").nth(1)).toHaveText("00:00:01.800");
  await expect(editedRow.locator(".line-time").first()).toHaveText("00:00:01.500");
  expect(await page.evaluate(() => document.querySelector("video").currentTime)).toBe(1.8);
  await page.evaluate(() => document.querySelector("video").play());
  const beforeEnd = await page.evaluate(() => document.querySelector("video").currentTime);
  await editedRow.getByRole("button", { name: /Set end line/ }).click();
  const afterEnd = await page.evaluate(() => document.querySelector("video").currentTime);
  await page.evaluate(() => document.querySelector("video").pause());
  const syncedEnd = Number((await editedRow.locator(".line-time").nth(1).textContent()).split(":").at(-1));
  expect(syncedEnd).toBeGreaterThanOrEqual(Math.floor(beforeEnd * 1000 + 1e-6) / 1000);
  expect(syncedEnd).toBeLessThanOrEqual(afterEnd + 0.01);
  await expect(editedRow.locator(".line-time").first()).toHaveText("00:00:01.500");
  await page.evaluate(() => document.querySelector("video").play());
  const beforeSync = await page.evaluate(
    () => document.querySelector("video").currentTime,
  );
  await editedRow.getByRole("button", { name: /Set start line/ }).click();
  const afterSync = await page.evaluate(
    () => document.querySelector("video").currentTime,
  );
  await page.evaluate(() => document.querySelector("video").pause());
  const syncedStart = Number(
    (await editedRow.locator("td").nth(1).locator(".line-time").textContent())
      .split(":")
      .at(-1),
  );
  expect(syncedStart).toBeGreaterThanOrEqual(
    Math.floor(beforeSync * 1000 + 1e-6) / 1000,
  );
  expect(syncedStart).toBeLessThanOrEqual(afterSync + 0.01);
  await page.getByRole("button", { name: "Delete Line", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const prefs = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );
  expect(prefs.contextIsolation).toBe(true);
  expect(prefs.nodeIntegration).toBe(false);
  expect(errors).toEqual([]);
  const remembered = JSON.parse(
    await readFile(join(userData, "dialog-folders.json"), "utf8"),
  );
  expect(remembered).toEqual({ video: temp, subtitle: temp, save: temp });
  await page.getByRole("button", { name: "Save As…", exact: true }).click();
  await expect(page.locator(".filename")).not.toContainText("*");
  await writeFile(
    ass,
    "[Events]\nFormat: Start, End, Text\nDialogue: 0:03:12.54,870387:58:03.14,Broken End\nDialogue: 870387:58:03.15,1305581:55:16.94,Beyond song" +
      Array.from(
        { length: 10 },
        (_, index) =>
          `\nDialogue: 0:${String(10 + index).padStart(2, "0")}:00.00,0:${String(10 + index).padStart(2, "0")}:02.00,Extra ${index}`,
      ).join(""),
  );
  await page.getByRole("button", { name: "Open ASS", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  const lateButton = page
    .locator("tbody tr")
    .last()
    .getByRole("button", { name: /Set start line/ });
  await expect(lateButton).toBeVisible();
  await expect(lateButton).toBeEnabled();
  await page
    .locator("tbody tr")
    .last()
    .locator(".line-time")
    .first()
    .dblclick();
  await expect(lateButton).toBeVisible();
  await page
    .getByRole("textbox", { name: "Edit start", exact: true })
    .press("Escape");
  await page.evaluate(() => {
    document.querySelector("video").currentTime = 1;
  });
  await page.waitForFunction(() => !document.querySelector("video").seeking);
  await lateButton.click();
  const repairedRow = page
    .locator("tbody tr")
    .filter({ hasText: "Beyond song" });
  await expect(repairedRow.locator(".line-time").first()).toHaveText(
    "00:00:01.000",
  );
  await expect(repairedRow.locator(".line-time").nth(1)).toHaveText(
    "00:00:03.000",
  );
  await expect(
    repairedRow.getByRole("button", { name: /Set start line/ }),
  ).toBeVisible();
  await expect(repairedRow).toHaveAttribute("aria-selected", "true");
  const position = await repairedRow.boundingBox();
  const viewport = await page.locator(".table-panel").boundingBox();
  expect(position.y).toBeGreaterThanOrEqual(viewport.y);
  expect(position.y + position.height).toBeLessThanOrEqual(
    viewport.y + viewport.height + 1,
  );
  await page.screenshot({ path: join(temp, "smoke.png") });
  console.log(
    "PASS: Electron launch, local video, Burn MP4 without changing ASS/dirty state, slider drag during playback, overlay, row seek, edits, cancel, save, add/delete, unsaved cancel, isolation.",
  );
} finally {
  // A mocked Cancel must never leave a test window running with fake dialogs.
  const child = app.process();
  const cleanupTimeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows())
        window.removeAllListeners("close");
    });
    await app.close();
  } finally {
    clearTimeout(cleanupTimeout);
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
    await rm(temp, { recursive: true, force: true });
  }
}
