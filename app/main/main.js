// app/main/main.js
const path = require("path");
const { app, BrowserWindow, dialog } = require("electron");
const { initDB } = require("../../backend/db");

// Register all IPC handlers (keeps main.js clean)
const { registerIpcHandlers } = require("./ipc");

const isDev =
  !app.isPackaged ||
  process.env.ELECTRON_ENV === "development" ||
  process.env.NODE_ENV === "development";

let mainWindow = null;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false, // show after ready-to-show (prevents white flash)
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Load entry page
  // Adjust if your HTML lives elsewhere (e.g. ui/login.html)
  const startPage = path.join(
    __dirname,
    "..",
    "renderer",
    "pages",
    "login",
    "login.html"
  );

  win.loadFile(startPage).catch((err) => {
    dialog.showErrorBox("Failed to load UI", String(err?.message || err));
  });

  win.once("ready-to-show", () => {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: "detach" });
  });

  // Security: prevent new windows from unknown sources
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only local files or your approved urls
    if (url.startsWith("file://")) return { action: "allow" };
    return { action: "deny" };
  });

  return win;
}

function setupAppSecurity() {
  // OPTIONAL: remove menu for a cleaner POS feel
  // BrowserWindow.setMenuBarVisibility(false);

  app.on("web-contents-created", (_event, contents) => {
    // Block navigation to external sites
    contents.on("will-navigate", (e, url) => {
      if (!url.startsWith("file://")) e.preventDefault();
    });

    // Extra hardening: no attach-webview
    contents.on("will-attach-webview", (e) => e.preventDefault());
  });
}

app.whenReady().then(async () => {
  setupAppSecurity();

  // ✅ REQUIRED: init DB (migrations + seed admin) before IPC uses repos
  await initDB();

  mainWindow = createMainWindow();

  registerIpcHandlers({ mainWindow });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      registerIpcHandlers({ mainWindow });
    }
  });
});


app.on("window-all-closed", () => {
  // Typical POS behavior: quit on Windows/Linux, keep alive on macOS
  if (process.platform !== "darwin") app.quit();
});

// Catch unexpected errors
process.on("uncaughtException", (err) => {
  try {
    dialog.showErrorBox("App Error", String(err?.stack || err));
  } catch (_) {}
});
