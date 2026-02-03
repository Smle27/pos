// app/main/ipc/printer.ipc.js
const { ipcMain, BrowserWindow } = require("electron");
const { printSale } = require("../printing/print");
const store = require("../store"); // your JSON store

function registerPrinterIpc() {
  ipcMain.handle("printer:list", async () => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.webContents.getPrinters();
  });

  ipcMain.handle("printer:getConfig", async () => {
    return store.get("printer") || {};
  });

  ipcMain.handle("printer:saveConfig", async (_e, cfg) => {
    store.set("printer", cfg);
    return { ok: true };
  });

  ipcMain.handle("printer:test", async () => {
    const cfg = store.get("printer") || {};
    if (!cfg?.printerName) return { ok: false, code: "NO_PRINTER", message: "No printer selected" };

    await printSale({
      shopName: "OLIVES POS",
      shopAddress: "Kampala, Uganda",
      shopPhone: "0700000000",
      logoText: "OP",
      invoiceNo: "TEST-001",
      date: new Date().toLocaleString(),
      cashier: "ADMIN",
      customer: { name: "Test Customer", phone: "0700..." },
      items: [
        { name: "Test Item", barcode: "0001", qty: 1, price: "0", total: "0" }
      ],
      subtotal: "0",
      discount: "0",
      total: "0",
      paid: "0",
      change: "0",
      payments: [{ method: "CASH", amount: 0 }],
      footer: "Thank you for shopping with us"
    }, cfg);

    return { ok: true };
  });

  ipcMain.handle("printer:printSale", async (_e, payload) => {
    const cfg = store.get("printer") || {};
    if (!cfg?.printerName) return { ok: false, code: "NO_PRINTER", message: "No printer selected" };

    await printSale(payload, cfg);
    return { ok: true };
  });
}

module.exports = { registerPrinterIpc };
