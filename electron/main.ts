import { app, BrowserWindow, dialog, ipcMain, protocol, Menu } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { videoResponse } from "./media";
import { randomUUID } from "node:crypto";
import { parseAss } from "../src/lib/assParser";
import { DialogFolders } from "./dialogFolders";
let win: BrowserWindow;
let dirty = false;
let allowClose = false;
let subtitlePath: string | undefined;
const videos = new Map<string, string>();
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);
function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  if (
    event.sender !== win.webContents ||
    event.senderFrame !== win.webContents.mainFrame
  )
    throw new Error("Untrusted IPC sender");
}
app.whenReady().then(async () => {
  const folders = new DialogFolders(
    join(app.getPath("userData"), "dialog-folders.json"),
  );
  await folders.load();
  protocol.handle("media", (request) => {
    const url = new URL(request.url);
    const path = videos.get(url.hostname);
    if (!path || url.pathname !== "/video")
      return new Response("Not found", { status: 404 });
    return videoResponse(request, path);
  });
  win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#15171c",
    title: "Mini ASS Editor",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [{ role: "toggleDevTools" }, { role: "togglefullscreen" }],
      },
    ]),
  );
  ipcMain.handle("open-video", async (event) => {
    trusted(event);
    const result = await dialog.showOpenDialog(win, {
      defaultPath: await folders.folder("video"),
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: ["mp4", "mov", "webm"] }],
    });
    if (result.canceled) return null;
    const path = result.filePaths[0];
    await folders.remember("video", path);
    videos.clear();
    const token = randomUUID();
    videos.set(token, path);
    return { name: basename(path), url: `media://${token}/video` };
  });
  ipcMain.handle("open-subtitle", async (event) => {
    trusted(event);
    const result = await dialog.showOpenDialog(win, {
      defaultPath: await folders.folder("subtitle"),
      properties: ["openFile"],
      filters: [{ name: "ASS / SSA subtitle", extensions: ["ass", "ssa"] }],
    });
    if (result.canceled) return null;
    const path = result.filePaths[0];
    const content = await readFile(path, "utf8");
    parseAss(content);
    subtitlePath = path;
    await folders.remember("subtitle", path);
    return { name: basename(path), content };
  });
  ipcMain.handle(
    "save-subtitle",
    async (event, content: unknown, saveAs: unknown) => {
      trusted(event);
      if (typeof content !== "string" || typeof saveAs !== "boolean")
        throw new Error("Invalid save request");
      let path = subtitlePath;
      if (saveAs || !path || !path.toLowerCase().endsWith(".ass")) {
        const result = await dialog.showSaveDialog(win, {
          defaultPath: await folders.savePath(path),
          filters: [{ name: "ASS subtitle", extensions: ["ass"] }],
        });
        if (result.canceled || !result.filePath) return null;
        path = result.filePath;
      }
      await writeFile(path, content, "utf8");
      subtitlePath = path;
      await folders.remember("save", path);
      dirty = false;
      return { name: basename(path) };
    },
  );
  ipcMain.handle("confirm-replace", async (event) => {
    trusted(event);
    const result = await dialog.showMessageBox(win, {
      type: "warning",
      message: "Save subtitle changes?",
      detail: "Your subtitle has unsaved changes.",
      buttons: ["Save", "Discard", "Cancel"],
      defaultId: 0,
      cancelId: 2,
    });
    return ["save", "discard", "cancel"][result.response];
  });
  ipcMain.on("dirty", (event, value) => {
    trusted(event);
    dirty = value === true;
    win.setDocumentEdited(dirty);
  });
  ipcMain.on("close-approved", (event) => {
    trusted(event);
    allowClose = true;
    win.close();
  });
  win.on("close", (event) => {
    if (dirty && !allowClose) {
      event.preventDefault();
      win.webContents.send("close-request");
    }
  });
  if (process.env.VITE_DEV_SERVER_URL)
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else void win.loadFile(join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
