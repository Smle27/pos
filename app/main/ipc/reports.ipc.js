// app/main/ipc/reports.ipc.js
const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const { requireAdmin } = require("../security/permissions");

const reportsService = require("../../../backend/services/reports.service");

function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };

  const lines = [];
  lines.push(headers.map(h => esc(h.label)).join(","));
  rows.forEach(r => lines.push(headers.map(h => esc(r[h.key])).join(",")));
  return lines.join("\n") + "\n";
}

async function pickSavePath({ title, defaultName } = {}) {
  const res = await dialog.showSaveDialog({
    title: title || "Save CSV",
    defaultPath: defaultName || "report.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (res.canceled || !res.filePath) return null;
  return res.filePath.endsWith(".csv") ? res.filePath : (res.filePath + ".csv");
}

function registerReportsIpc() {
  ipcMain.handle(
    "reports:summary",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, userId } = payload || {};
        const res = await reportsService.summary({ from, to, userId });
        return { ok: true, data: res || { grossSales: 0, transactions: 0 } };
      } catch (err) {
        return { ok: false, code: "REPORTS_SUMMARY_ERROR", message: err?.message || "Failed to load summary" };
      }
    })
  );

  ipcMain.handle(
    "reports:sales",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, userId, limit = 200 } = payload || {};
        const res = await reportsService.sales({ from, to, userId, limit });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "REPORTS_SALES_ERROR", message: err?.message || "Failed to load sales" };
      }
    })
  );

  ipcMain.handle(
    "reports:topProducts",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, userId, limit = 30 } = payload || {};
        const res = await reportsService.topProducts({ from, to, userId, limit });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "REPORTS_TOP_ERROR", message: err?.message || "Failed to load top products" };
      }
    })
  );

  ipcMain.handle(
    "reports:exportSalesCSV",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, userId, limit = 500 } = payload || {};
        const rows = await reportsService.sales({ from, to, userId, limit });

        const csv = toCSV(rows || [], [
          { key: "id", label: "Sale ID" },
          { key: "created_at", label: "Date" },
          { key: "username", label: "Cashier" },
          { key: "total", label: "Total" },
          { key: "paid", label: "Paid" },
          { key: "change", label: "Change" },
          { key: "payment_method", label: "Payment Method" },
          { key: "status", label: "Status" },
        ]);

        const fname = `sales_${from || "all"}_${to || "all"}.csv`;
        const filePath = await pickSavePath({ title: "Export Sales CSV", defaultName: fname });
        if (!filePath) return { ok: false, code: "CANCELED", message: "Export canceled" };

        fs.writeFileSync(filePath, csv, "utf-8");
        return { ok: true, data: { filePath } };
      } catch (err) {
        return { ok: false, code: "REPORTS_EXPORT_SALES_ERROR", message: err?.message || "Failed to export sales CSV" };
      }
    })
  );

  ipcMain.handle(
    "reports:exportTopCSV",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, userId, limit = 200 } = payload || {};
        const rows = await reportsService.topProducts({ from, to, userId, limit });

        const csv = toCSV(rows || [], [
          { key: "product_id", label: "Product ID" },
          { key: "name", label: "Product" },
          { key: "barcode", label: "Barcode" },
          { key: "qtySold", label: "Qty Sold" },
          { key: "revenue", label: "Revenue" },
          { key: "costTotal", label: "Cost Total" },
          { key: "profit", label: "Profit" },
        ]);

        const fname = `top_products_${from || "all"}_${to || "all"}.csv`;
        const filePath = await pickSavePath({ title: "Export Top Products CSV", defaultName: fname });
        if (!filePath) return { ok: false, code: "CANCELED", message: "Export canceled" };

        fs.writeFileSync(filePath, csv, "utf-8");
        return { ok: true, data: { filePath } };
      } catch (err) {
        return { ok: false, code: "REPORTS_EXPORT_TOP_ERROR", message: err?.message || "Failed to export top products CSV" };
      }
    })
  );
}

module.exports = { registerReportsIpc };
