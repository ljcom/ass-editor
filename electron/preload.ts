import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI } from "../src/types/subtitle";
const api: DesktopAPI = {
  openVideo: () => ipcRenderer.invoke("open-video"),
  openSubtitle: () => ipcRenderer.invoke("open-subtitle"),
  saveSubtitle: (content, saveAs) =>
    ipcRenderer.invoke("save-subtitle", content, saveAs),
  burnVideo: (url, content) => ipcRenderer.invoke("burn-video", url, content),
  cancelBurn: () => ipcRenderer.send("cancel-burn"),
  onBurnProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, seconds: number) => callback(seconds);
    ipcRenderer.on("burn-progress", handler);
    return () => ipcRenderer.removeListener("burn-progress", handler);
  },
  setDirty: (dirty) => ipcRenderer.send("dirty", dirty),
  confirmReplace: () => ipcRenderer.invoke("confirm-replace"),
  onCloseRequest: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("close-request", handler);
    return () => ipcRenderer.removeListener("close-request", handler);
  },
  close: () => ipcRenderer.send("close-approved"),
};
contextBridge.exposeInMainWorld("desktop", api);
