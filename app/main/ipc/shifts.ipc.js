// app/main/ipc/shifts.ipc.js
const { ipcMain } = require("electron");
const shiftService = require("../../../backend/services/shift.service");
const { requireAuth, requireAdmin } = require("../security/permissions");

function registerShiftsIpc() {
  ipcMain.handle(
    "shifts:myOpen",
    requireAuth(async (_e, _payload, session) => {
      try {
        const res = await shiftService.myOpen({ userId: session.user.id });
        return { ok: true, data: res || null };
      } catch (err) {
        return { ok: false, code: "SHIFT_MYOPEN_ERROR", message: err?.message || "Failed" };
      }
    })
  );

  ipcMain.handle(
    "shifts:open",
    requireAuth(async (_e, payload, session) => {
      try {
        const { openingCash, notes } = payload || {};
        const res = await shiftService.open({
          userId: session.user.id,
          openingCash: Number(openingCash || 0),
          note: notes || null,
        });
        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "SHIFT_OPEN_ERROR", message: err?.message || "Failed" };
      }
    })
  );

  ipcMain.handle(
    "shifts:close",
    requireAuth(async (_e, payload, session) => {
      try {
        const { countedCash, notes } = payload || {};
        const res = await shiftService.close({
          userId: session.user.id,
          closingCash: Number(countedCash || 0),
          note: notes || null,
        });
        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "SHIFT_CLOSE_ERROR", message: err?.message || "Failed" };
      }
    })
  );

  ipcMain.handle(
    "shifts:list",
    requireAdmin(async (_e, payload) => {
      try {
        const res = await shiftService.list(payload || {});
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "SHIFT_LIST_ERROR", message: err?.message || "Failed" };
      }
    })
  );
}

module.exports = { registerShiftsIpc };
