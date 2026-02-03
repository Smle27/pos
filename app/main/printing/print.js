// app/main/printing/print.js
const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

function fill(tpl, map) {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) {
    out = out.replaceAll(`{{${k}}}`, v ?? "");
  }
  return out;
}

async function loadHtml(templateRelPath) {
  return fs.readFileSync(path.join(__dirname, templateRelPath), "utf8");
}

async function printHtml(html, config) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  });

  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

  await win.webContents.print({
    silent: true,
    deviceName: config.printerName,
    margins: { marginType: "none" },
    printBackground: true
  });

  win.destroy();
}

async function printReceiptThermal(data, config) {
  const tpl = await loadHtml("../../renderer/shared/receipt/receipt.html");

  const itemsHtml = (data.items || []).map(i => `
    <div class="row small">
      <span>${i.name} x${i.qty}</span>
      <span>${i.total}</span>
    </div>
  `).join("");

  const html = fill(tpl, {
    shopName: data.shopName || "",
    shopPhone: data.shopPhone || "",
    receiptNo: String(data.receiptNo || ""),
    date: String(data.date || ""),
    cashier: String(data.cashier || ""),
    items: itemsHtml,
    total: String(data.total || ""),
    paid: String(data.paid || ""),
    change: String(data.change || ""),
    footer: String(config.footer || data.footer || "")
  });

  return printHtml(html, config);
}

async function printInvoiceA4(data, config) {
  const tpl = await loadHtml("../../renderer/shared/receipt/invoice-a4.html");

  const rows = (data.items || []).map(i => `
    <tr>
      <td>${i.name || ""}</td>
      <td>${i.barcode || ""}</td>
      <td class="num">${i.qty ?? ""}</td>
      <td class="num">${i.price ?? ""}</td>
      <td class="num">${i.total ?? ""}</td>
    </tr>
  `).join("");

  const html = fill(tpl, {
    logoText: data.logoText || "OP",
    shopName: data.shopName || "",
    shopAddress: data.shopAddress || "",
    shopPhone: data.shopPhone || "",
    invoiceNo: String(data.invoiceNo || data.receiptNo || ""),
    date: String(data.date || ""),
    cashier: String(data.cashier || ""),

    customerName: data.customer?.name || data.customerName || "Walk-in Customer",
    customerPhone: data.customer?.phone || data.customerPhone || "-",

    method: (data.payments?.[0]?.method || data.method || "CASH"),
    paid: String(data.paid || ""),
    change: String(data.change || ""),

    rows,
    subtotal: String(data.subtotal || data.total || ""),
    discount: String(data.discount || "0"),
    total: String(data.total || ""),
    footer: String(config.footer || data.footer || "Thank you.")
  });

  return printHtml(html, config);
}

async function printSale(data, config) {
  const paper = (config.paperSize || "58").toUpperCase();

  if (paper === "A4") return printInvoiceA4(data, config);
  return printReceiptThermal(data, config); // default thermal
}

module.exports = { printSale };
