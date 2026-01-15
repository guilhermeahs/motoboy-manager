const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// =============================================================
//  Motoboy Manager - Main Process (Electron)
//  - Abre o index.html da raiz
//  - Topbar custom (frame: false)
//  - Backup em arquivo (Documentos/MotoboyManager/backup.json)
//  - Auto-update (somente quando empacotado/instalado)
// =============================================================

let mainWindow = null;

// Backup em arquivo: Documentos/MotoboyManager/backup.json
const BACKUP_DIR_NAME = "MotoboyManager";
let BACKUP_DIR = "";
let BACKUP_FILE = "";

function initBackupPaths() {
  BACKUP_DIR = path.join(app.getPath("documents"), BACKUP_DIR_NAME);
  BACKUP_FILE = path.join(BACKUP_DIR, "backup.json");
}

function ensureBackupDir() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (_) { }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0f1115",

    // Topbar custom
    frame: false,
    autoHideMenuBar: true,

    // ✅ ÍCONE DA JANELA
    icon: path.join(__dirname, "..", "assets", "icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove menu do app (File/Edit/View...)
  try {
    Menu.setApplicationMenu(null);
  } catch (_) { }

  // index.html está na RAIZ do projeto (um nível acima de /src)
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
  // mainWindow.webContents.openDevTools();
}

function sendToUI(channel, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

// =============================================================
// Auto-update (electron-updater)
// - Só ativa quando o app está empacotado (instalador)
// - No dev, a UI continua existindo, mas os botões só mostram aviso
// =============================================================
function setupAutoUpdate() {
  // No dev, não tenta atualizar (evita erro/ruído)
  if (!app.isPackaged) {
    ipcMain.handle("upd:checkNow", async () => {
      sendToUI("upd:status", "Atualizações ficam disponíveis apenas no instalador (versão empacotada). ");
      return { ok: true, dev: true };
    });
    ipcMain.handle("upd:quitAndInstall", async () => ({ ok: false, dev: true }));
    return;
  }

  // Carrega electron-updater só quando empacotado
  let autoUpdater;
  try {
    // eslint-disable-next-line global-require
    ({ autoUpdater } = require("electron-updater"));
  } catch (e) {
    sendToUI("upd:error", "electron-updater não está instalado/configurado: " + String(e));
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => sendToUI("upd:status", "Procurando atualização..."));
  autoUpdater.on("update-available", (info) => sendToUI("upd:available", info));
  autoUpdater.on("update-not-available", () => sendToUI("upd:status", "Você já está na versão mais recente."));
  autoUpdater.on("error", (err) => sendToUI("upd:error", (err && err.message) ? err.message : String(err)));
  autoUpdater.on("download-progress", (p) => sendToUI("upd:progress", p));
  autoUpdater.on("update-downloaded", (info) => sendToUI("upd:downloaded", info));

  ipcMain.handle("upd:quitAndInstall", async () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  ipcMain.handle("upd:checkNow", async () => {
    autoUpdater.checkForUpdatesAndNotify();
    return { ok: true };
  });

  // Checa ao abrir
  autoUpdater.checkForUpdatesAndNotify();

  // Checar a cada 6h
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000);
}

// =============================================================
// App lifecycle
// =============================================================
app.whenReady().then(() => {
  initBackupPaths();
  createWindow();
  setupAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// =============================================================
// Window controls (topbar)
// =============================================================
ipcMain.on("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});

ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// =============================================================
// Backup IPC
// =============================================================
ipcMain.handle("backup:save", async (_, state) => {
  try {
    ensureBackupDir();
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(state, null, 2), "utf-8");
    return { ok: true, path: BACKUP_FILE };
  } catch (e) {
    return { ok: false, error: String(e), path: BACKUP_FILE };
  }
});

ipcMain.handle("backup:load", async () => {
  try {
    ensureBackupDir();
    if (!fs.existsSync(BACKUP_FILE)) return { ok: false, path: BACKUP_FILE };
    const raw = fs.readFileSync(BACKUP_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return { ok: true, state: parsed, path: BACKUP_FILE };
  } catch (e) {
    return { ok: false, error: String(e), path: BACKUP_FILE };
  }
});

ipcMain.handle("backup:reveal", async () => {
  try {
    ensureBackupDir();
    await shell.openPath(BACKUP_DIR);
    return { ok: true, dir: BACKUP_DIR };
  } catch (e) {
    return { ok: false, error: String(e), dir: BACKUP_DIR };
  }
});

// Retorna versão do app
ipcMain.handle("app:getVersion", async () => {
  return app.getVersion();
});

// Retorna changelog.json (se existir)
ipcMain.handle("app:getChangelog", async () => {
  try {
    const file = path.join(app.getAppPath(), "changelog.json");
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
});

