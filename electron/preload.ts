import { contextBridge, ipcRenderer } from "electron";
import type { DesktopAPI } from "../src/types/subtitle";
const api: DesktopAPI = {
  openVideo: () => ipcRenderer.invoke("open-video"),
  openSubtitle: () => ipcRenderer.invoke("open-subtitle"),
  saveSubtitle: (content, saveAs) =>
    ipcRenderer.invoke("save-subtitle", content, saveAs),
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
