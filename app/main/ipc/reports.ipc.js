// app/main/ipc/reports.ipc.js
const { ipcMain } = require("electron");
const { requireAdmin } = require("../security/permissions");

const reportsService = require("../../../backend/services/reports.service");

function registerReportsIpc() {
  // SUMMARY
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

  // SALES LIST
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

  // TOP PRODUCTS
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
}

module.exports = { registerReportsIpc };
