const { contextBridge, ipcRenderer } = require("electron");

// Exponha apenas o necessário para o front (index.html)
contextBridge.exposeInMainWorld("electronAPI", {
  // Controles da janela (topbar custom)
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // Backup em arquivo (Documentos/MotoboyManager/backup.json)
  saveBackup: (state) => ipcRenderer.invoke("backup:save", state),
  loadBackup: () => ipcRenderer.invoke("backup:load"),
  revealBackupFolder: () => ipcRenderer.invoke("backup:reveal")
});

// Auto-update (electron-updater)
// Observação: no modo dev, os handlers retornam aviso (ver src/main.js)
contextBridge.exposeInMainWorld("updates", {
  checkNow: () => ipcRenderer.invoke("upd:checkNow"),
  quitAndInstall: () => ipcRenderer.invoke("upd:quitAndInstall"),
  onStatus: (cb) => ipcRenderer.on("upd:status", (_, msg) => cb(msg)),
  onAvailable: (cb) => ipcRenderer.on("upd:available", (_, info) => cb(info)),
  onProgress: (cb) => ipcRenderer.on("upd:progress", (_, p) => cb(p)),
  onDownloaded: (cb) => ipcRenderer.on("upd:downloaded", (_, info) => cb(info)),
  onError: (cb) => ipcRenderer.on("upd:error", (_, msg) => cb(msg))
});
