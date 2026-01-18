const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ✅ Ajuda o Windows (taskbar/pin/atalhos) a associar ícone corretamente
app.setAppUserModelId("com.suaempresa.motoboymanager");

// ✅ Caminho do ícone:
// - DEV: /assets/icon.png
// - PACKAGED: tenta resources/assets/icon.png; se não existir, usa assets dentro do app
const iconPath = (() => {
  if (!app.isPackaged) return path.join(__dirname, "..", "assets", "icon.png");

  const p1 = path.join(process.resourcesPath, "assets", "icon.png"); // se você usar extraResources
  if (fs.existsSync(p1)) return p1;

  // fallback (funciona se assets estiver dentro do app.asar / build)
  const p2 = path.join(app.getAppPath(), "assets", "icon.png");
  return p2;
})();

// =============================================================
//  Motoboy Manager - Main Process (Electron)
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
  } catch (_) {}
}

function sendToUI(channel, payload) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

// =============================================================
// Helpers: Release Notes / Changelog local
// =============================================================
function stripHtml(s = "") {
  return String(s).replace(/<[^>]*>/g, "").trim();
}

function normalizeReleaseNotes(releaseNotes) {
  if (!releaseNotes) return "";
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((x) => stripHtml(x?.note ?? x))
      .filter(Boolean)
      .join("\n\n");
  }
  return stripHtml(releaseNotes);
}

function readLocalChangelog() {
  try {
    const file = path.join(app.getAppPath(), "changelog.json"); // seu arquivo está na raiz ✅
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function notesFromLocalChangelog(changelog, version) {
  if (!changelog || !version) return "";
  const v = changelog[version];
  if (!v) return "";
  if (Array.isArray(v)) return v.join("\n");
  if (typeof v === "string") return v;
  return "";
}

// =============================================================
// Window
// =============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#0f1115",

    frame: false,
    autoHideMenuBar: true,
    icon: iconPath,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,

      // ✅ DevTools desativado
      devTools: false,
    }
  });

  try { Menu.setApplicationMenu(null); } catch (_) {}

  // bloqueia atalhos do DevTools (F12 / Ctrl+Shift+I/J/C)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = (input.key || "").toLowerCase();
    const ctrlOrCmd = input.control || input.meta;
    const isDevtoolsCombo =
      input.key === "F12" ||
      (ctrlOrCmd && input.shift && (key === "i" || key === "j" || key === "c"));
    if (isDevtoolsCombo) event.preventDefault();
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

// =============================================================
// Auto-update (electron-updater)
// =============================================================
function setupAutoUpdate() {
  // No dev, não tenta atualizar (evita erro/ruído)
  if (!app.isPackaged) {
    ipcMain.handle("upd:checkNow", async () => {
      sendToUI("upd:status", "Atualizações ficam disponíveis apenas no instalador (versão empacotada).");
      return { ok: true, dev: true };
    });
    ipcMain.handle("upd:quitAndInstall", async () => ({ ok: false, dev: true }));
    return;
  }

  let autoUpdater;
  try {
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

  // ✅ Quando baixar: usa changelog.json (local) e cai pro releaseNotes se precisar
  autoUpdater.on("update-downloaded", async (info) => {
    sendToUI("upd:downloaded", info);

    const ver = info?.version ? String(info.version) : "";

    const local = readLocalChangelog();
    const localNotes = notesFromLocalChangelog(local, ver);

    const gitNotes = normalizeReleaseNotes(info?.releaseNotes);

    const notes =
      (localNotes && localNotes.trim()) ||
      (gitNotes && gitNotes.trim()) ||
      "Sem changelog nesta versão.";

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Atualização baixada",
      message: ver ? `Nova versão ${ver} pronta para instalar` : "Nova versão pronta para instalar",
      detail: `Changelog:\n\n${notes}`,
      buttons: ["Instalar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (response === 0) {
      sendToUI("upd:status", "Fechando para instalar atualização...");
      if (mainWindow) mainWindow.hide();
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 300);
    }
  });

  ipcMain.handle("upd:quitAndInstall", async () => {
    sendToUI("upd:status", "Fechando para instalar atualização...");
    if (mainWindow) mainWindow.hide();
    setTimeout(() => autoUpdater.quitAndInstall(false, true), 300);
    return { ok: true };
  });

  ipcMain.handle("upd:checkNow", async () => {
    autoUpdater.checkForUpdates();
    return { ok: true };
  });

  // Checa ao abrir + a cada 6h
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 6 * 60 * 60 * 1000);
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
