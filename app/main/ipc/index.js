// app/main/ipc/index.js
const { ipcMain } = require("electron");

const { registerAuthIpc } = require("./auth.ipc");
const { registerSalesIpc } = require("./sales.ipc");
const { registerProductsIpc } = require("./products.ipc");
const { registerStockIpc } = require("./stock.ipc");
const { registerUsersIpc } = require("./users.ipc");
const { registerReportsIpc } = require("./reports.ipc");
const { registerPrinterIpc } = require("./printer.ipc");
const { registerShiftsIpc } = require("./shifts.ipc");

function registerIpcHandlers({ mainWindow } = {}) {
  // Register module IPC handlers (Option B)
  registerAuthIpc();
  registerSalesIpc();
  registerProductsIpc();
  registerStockIpc();
  registerUsersIpc();
  registerReportsIpc();
  registerPrinterIpc();
  registerShiftsIpc();

  // Small app helpers
  ipcMain.handle("app:ping", async () => ({ ok: true, data: "pong" }));

  ipcMain.handle("app:focus", async () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
      return { ok: true };
    } catch (err) {
      return { ok: false, code: "FOCUS_ERROR", message: err?.message || "Failed to focus window" };
    }
  });
}

module.exports = { registerIpcHandlers };
