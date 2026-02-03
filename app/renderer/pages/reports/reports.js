// app/main/ipc/reports.ipc.js
const { ipcMain } = require("electron");
const { requireAdmin } = require("../security/permissions");

// If you already have backend/reportsService.js, use it.
// Else it can be inside posService.
let svc;
try {
  svc = require("../../backend/reportsService");
} catch (_) {
  svc = require("../../backend/posService");
}

function registerReportsIpc() {
  // Summary: gross sales, tx count, etc.
  ipcMain.handle(
    "reports:summary",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, cashier } = payload || {};
        const res =
          (await svc.summary?.({ from, to, cashier })) ??
          (await svc.getSummary?.({ from, to, cashier })) ??
          (await svc.reportsSummary?.({ from, to, cashier })) ??
          (await svc.reports?.summary?.({ from, to, cashier }));

        if (!res) return { ok: true, data: { grossSales: 0, transactions: 0 } };
        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "REPORTS_SUMMARY_ERROR", message: err?.message || "Failed to load summary" };
      }
    })
  );

  // Sales list (recent)
  ipcMain.handle(
    "reports:sales",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, cashier, limit = 200 } = payload || {};
        const res =
          (await svc.sales?.({ from, to, cashier, limit })) ??
          (await svc.listSales?.({ from, to, cashier, limit })) ??
          (await svc.reportsSales?.({ from, to, cashier, limit })) ??
          (await svc.reports?.sales?.({ from, to, cashier, limit }));

        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "REPORTS_SALES_ERROR", message: err?.message || "Failed to load sales" };
      }
    })
  );

  // Top products
  ipcMain.handle(
    "reports:topProducts",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, cashier, limit = 30 } = payload || {};
        const res =
          (await svc.topProducts?.({ from, to, cashier, limit })) ??
          (await svc.getTopProducts?.({ from, to, cashier, limit })) ??
          (await svc.reportsTopProducts?.({ from, to, cashier, limit })) ??
          (await svc.reports?.topProducts?.({ from, to, cashier, limit }));

        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "REPORTS_TOP_ERROR", message: err?.message || "Failed to load top products" };
      }
    })
  );

  // Export CSV: Sales
  ipcMain.handle(
    "reports:exportSalesCSV",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, cashier } = payload || {};
        const res =
          (await svc.exportSalesCSV?.({ from, to, cashier })) ??
          (await svc.exportCSV?.({ from, to, cashier, type: "sales" })) ??
          (await svc.reportsExportSalesCSV?.({ from, to, cashier }));

        return { ok: true, data: res ?? true };
      } catch (err) {
        return { ok: false, code: "EXPORT_SALES_ERROR", message: err?.message || "Failed to export sales CSV" };
      }
    })
  );

  // Export CSV: Top products
  ipcMain.handle(
    "reports:exportTopCSV",
    requireAdmin(async (_event, payload) => {
      try {
        const { from, to, cashier } = payload || {};
        const res =
          (await svc.exportTopProductsCSV?.({ from, to, cashier })) ??
          (await svc.exportCSV?.({ from, to, cashier, type: "top" })) ??
          (await svc.reportsExportTopCSV?.({ from, to, cashier }));

        return { ok: true, data: res ?? true };
      } catch (err) {
        return { ok: false, code: "EXPORT_TOP_ERROR", message: err?.message || "Failed to export top CSV" };
      }
    })
  );
}

module.exports = { registerReportsIpc };
