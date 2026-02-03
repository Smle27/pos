// app/main/ipc/sales.ipc.js
const { ipcMain } = require("electron");
const { requireCashier, requireAdmin } = require("../security/permissions");

const salesService = require("../../../backend/services/sales.service");

function registerSalesIpc() {
  // HOLD SALE (cashier)
  ipcMain.handle(
    "sales:hold",
    requireCashier(async (_event, payload, session) => {
      try {
        const { cartItems, customer, note } = payload || {};
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
          return { ok: false, code: "VALIDATION_ERROR", message: "Cart is empty" };
        }

        const res = await salesService.holdSale(cartItems, {
          userId: session?.user?.id ?? null,
          cashier: session?.user?.username ?? null,
          customer,
          note,
        });

        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "SALE_HOLD_ERROR", message: err?.message || "Failed to hold sale" };
      }
    })
  );

  // RESUME SALE (cashier)
  ipcMain.handle(
    "sales:resume",
    requireCashier(async (_event, payload) => {
      try {
        const { saleId } = payload || {};
        if (!saleId) return { ok: false, code: "VALIDATION_ERROR", message: "saleId is required" };

        const res = await salesService.getSale(saleId);
        if (!res) return { ok: false, code: "NOT_FOUND", message: "Sale not found" };

        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "SALE_RESUME_ERROR", message: err?.message || "Failed to resume sale" };
      }
    })
  );

  // LIST HELD SALES (cashier)
  ipcMain.handle(
    "sales:listHeld",
    requireCashier(async (_event, _payload, session) => {
      try {
        const res = await salesService.listHeldSales({
          userId: session?.user?.id ?? null, // show this cashier's held sales
          limit: 100,
        });

        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "SALE_LIST_ERROR", message: err?.message || "Failed to list held sales" };
      }
    })
  );

  // CHECKOUT (cashier)
  ipcMain.handle(
    "sales:checkout",
    requireCashier(async (_event, payload, session) => {
      try {
        const { cartItems, payments, customer, note, saleId, stockOverride, overrideUserId, overrideReason } = payload || {};

        // Stock override is ADMIN-only
        if (stockOverride && String(session?.user?.role || "").toUpperCase() !== "ADMIN") {
          return { ok: false, code: "FORBIDDEN", message: "Stock override requires ADMIN" };
        }

        const hasCart = Array.isArray(cartItems) && cartItems.length > 0;
        if (!hasCart && !saleId) {
          return { ok: false, code: "VALIDATION_ERROR", message: "Provide cartItems or saleId" };
        }

        if (!Array.isArray(payments) || payments.length === 0) {
          return { ok: false, code: "VALIDATION_ERROR", message: "Payment is required" };
        }

        let res;
        if (saleId && !hasCart) {
          res = await salesService.checkoutSale(saleId, {
            userId: session?.user?.id ?? null,
            cashier: session?.user?.username ?? null,
            payments,
            customer,
            note,
            stockOverride: !!stockOverride,
            overrideUserId: overrideUserId ?? null,
            overrideReason: overrideReason ?? null,
          });
        } else {
          res = await salesService.checkout(cartItems, {
            userId: session?.user?.id ?? null,
            cashier: session?.user?.username ?? null,
            payments,
            customer,
            note,
            saleId: saleId || null, // convert held -> paid
            stockOverride: !!stockOverride,
            overrideUserId: overrideUserId ?? null,
            overrideReason: overrideReason ?? null,
          });
        }

        return { ok: true, data: res };
      } catch (err) {
        const msg = err?.message || "Checkout failed";
        const code =
          msg.toLowerCase().includes("out of stock") ? "OUT_OF_STOCK" :
          msg.toLowerCase().includes("insufficient") ? "INSUFFICIENT_PAYMENT" :
          "CHECKOUT_ERROR";

        return { ok: false, code, message: msg };
      }
    })
  );

  // VOID HELD SALE (cashier)
  ipcMain.handle(
    "sales:voidHeld",
    requireCashier(async (_event, payload) => {
      try {
        const { saleId } = payload || {};
        if (!saleId) return { ok: false, code: "VALIDATION_ERROR", message: "saleId is required" };

        await salesService.voidSale(saleId, {});
        return { ok: true, data: true };
      } catch (err) {
        return { ok: false, code: "VOID_ERROR", message: err?.message || "Failed to void sale" };
      }
    })
  );

  // VOID PAID SALE (admin) + restock
  ipcMain.handle(
    "sales:voidPaid",
    requireAdmin(async (_event, payload, session) => {
      try {
        const { saleId, note } = payload || {};
        if (!saleId) return { ok: false, code: "VALIDATION_ERROR", message: "saleId is required" };

        const ok = await salesService.voidPaidSale(saleId, {
          userId: session?.user?.id ?? null,
          note: note ?? null,
        });
        return { ok: true, data: ok };
      } catch (err) {
        return { ok: false, code: "VOID_PAID_ERROR", message: err?.message || "Failed to void paid sale" };
      }
    })
  );

  // RECENT SALES (cashier/admin)
  ipcMain.handle(
    "sales:recent",
    requireCashier(async (_event, payload) => {
      try {
        const { limit = 100, from, to, status } = payload || {};
        const res = await salesService.listRecentSales({ limit, from, to, status });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "SALES_RECENT_ERROR", message: err?.message || "Failed to load sales" };
      }
    })
  );
}

module.exports = { registerSalesIpc };
