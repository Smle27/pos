// app/main/ipc/stock.ipc.js
const { ipcMain } = require("electron");
const { requireCashier, requireAdmin } = require("../security/permissions");

const stockService = require("../../../backend/services/stock.service");

function isEmpty(v) {
  return v === undefined || v === null || v === "";
}

function isValidNumber(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

function registerStockIpc() {
  // GET STOCK (cashier/admin)
  ipcMain.handle(
    "stock:get",
    requireCashier(async (_event, payload) => {
      try {
        const { productId } = payload || {};
        if (isEmpty(productId)) return { ok: false, code: "VALIDATION_ERROR", message: "productId is required" };

        const res = await stockService.getStock({ productId });
        if (!res) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "STOCK_GET_ERROR", message: err?.message || "Failed to get stock" };
      }
    })
  );

  // LIST LOW STOCK (cashier/admin)
  ipcMain.handle(
    "stock:low",
    requireCashier(async (_event, payload) => {
      try {
        const { threshold = 5, limit = 200, offset = 0 } = payload || {};

        if (!isValidNumber(threshold)) return { ok: false, code: "VALIDATION_ERROR", message: "threshold must be a number" };
        if (!isValidNumber(limit)) return { ok: false, code: "VALIDATION_ERROR", message: "limit must be a number" };
        if (!isValidNumber(offset)) return { ok: false, code: "VALIDATION_ERROR", message: "offset must be a number" };

        const res = await stockService.listLow({ threshold, limit, offset });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "STOCK_LOW_LIST_ERROR", message: err?.message || "Failed to list low stock" };
      }
    })
  );

  // LIST MOVES (cashier/admin)
  ipcMain.handle(
    "stock:moves",
    requireCashier(async (_event, payload) => {
      try {
        const { productId, limit = 200, from, to } = payload || {};

        if (!isValidNumber(limit)) return { ok: false, code: "VALIDATION_ERROR", message: "limit must be a number" };
        if (!isEmpty(productId) && !isValidNumber(productId)) {
          return { ok: false, code: "VALIDATION_ERROR", message: "productId must be a number" };
        }

        const res = await stockService.listMoves({ productId, limit, from, to });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "STOCK_MOVES_LIST_ERROR", message: err?.message || "Failed to list stock moves" };
      }
    })
  );

  // APPLY MOVE +/- (admin only)
  ipcMain.handle(
    "stock:move",
    requireAdmin(async (_event, payload, session) => {
      try {
        const { productId, qtyChange, reason, refType, refId, note } = payload || {};

        const userId = session?.user?.id ?? null;

        if (isEmpty(productId)) return { ok: false, code: "VALIDATION_ERROR", message: "productId is required" };
        if (isEmpty(qtyChange)) return { ok: false, code: "VALIDATION_ERROR", message: "qtyChange is required" };
        if (!isValidNumber(qtyChange)) return { ok: false, code: "VALIDATION_ERROR", message: "qtyChange must be a number" };
        if (Number(qtyChange) === 0) return { ok: false, code: "VALIDATION_ERROR", message: "qtyChange must be non-zero" };
        if (!reason) return { ok: false, code: "VALIDATION_ERROR", message: "reason is required" };

        // When reducing stock manually, force a note (audit + accountability)
        if (Number(qtyChange) < 0 && String(refType || "MANUAL").toUpperCase() === "MANUAL" && isEmpty(note)) {
          return { ok: false, code: "VALIDATION_ERROR", message: "note is required when reducing stock manually" };
        }

        const res = await stockService.applyMove({
          productId,
          qtyChange,
          reason,
          refType,
          refId,
          userId,
          note,
        });

        return { ok: true, data: res };
      } catch (err) {
        const msg = err?.message || "Failed to apply stock move";
        const code = msg.toLowerCase().includes("below 0")
          ? "NEGATIVE_STOCK"
          : msg.toLowerCase().includes("not found")
          ? "NOT_FOUND"
          : "STOCK_MOVE_ERROR";
        return { ok: false, code, message: msg };
      }
    })
  );

  // SET STOCK (admin only)
  ipcMain.handle(
    "stock:set",
    requireAdmin(async (_event, payload, session) => {
      try {
        const { productId, newQty, reason, refType, refId, note } = payload || {};

        const userId = session?.user?.id ?? null;

        if (isEmpty(productId)) return { ok: false, code: "VALIDATION_ERROR", message: "productId is required" };
        if (isEmpty(newQty)) return { ok: false, code: "VALIDATION_ERROR", message: "newQty is required" };
        if (!isValidNumber(newQty)) return { ok: false, code: "VALIDATION_ERROR", message: "newQty must be a number" };
        if (Number(newQty) < 0) return { ok: false, code: "VALIDATION_ERROR", message: "newQty must be >= 0" };

        // If setting stock lower than current (manual), force a note
        if (String(refType || "MANUAL").toUpperCase() === "MANUAL" && isEmpty(note)) {
          // we cannot compare to current stock here without a read, so we require note for all manual sets
          return { ok: false, code: "VALIDATION_ERROR", message: "note is required for manual stock set" };
        }

        const res = await stockService.setStock({
          productId,
          newQty,
          reason,
          refType,
          refId,
          userId,
          note,
        });

        return { ok: true, data: res };
      } catch (err) {
        const msg = err?.message || "Failed to set stock";
        const code = msg.toLowerCase().includes("below 0")
          ? "NEGATIVE_STOCK"
          : msg.toLowerCase().includes("not found")
          ? "NOT_FOUND"
          : "STOCK_SET_ERROR";
        return { ok: false, code, message: msg };
      }
    })
  );
}

module.exports = { registerStockIpc };
