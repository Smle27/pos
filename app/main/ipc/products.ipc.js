// app/main/ipc/products.ipc.js
const { ipcMain } = require("electron");
const { requireCashier, requireAdmin } = require("../security/permissions");

const productsService = require("../../../backend/services/products.service");

function registerProductsIpc() {
  // LIST PRODUCTS (cashier/admin)
  ipcMain.handle(
    "products:list",
    requireCashier(async (_event, payload) => {
      try {
        const { q = "", limit = 200 } = payload || {};
        const res = await productsService.list({ q, limit });
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "PRODUCT_LIST_ERROR", message: err?.message || "Failed to list products" };
      }
    })
  );

  // GET PRODUCT BY BARCODE (cashier/admin)
  ipcMain.handle(
    "products:byBarcode",
    requireCashier(async (_event, payload) => {
      try {
        const { barcode } = payload || {};
        if (!barcode) return { ok: false, code: "VALIDATION_ERROR", message: "barcode is required" };

        const p = await productsService.getByBarcode({ barcode });
        if (!p) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

        return { ok: true, data: p };
      } catch (err) {
        return { ok: false, code: "PRODUCT_GET_ERROR", message: err?.message || "Failed to fetch product" };
      }
    })
  );

  // CREATE PRODUCT (admin only)
  ipcMain.handle(
    "products:create",
    requireAdmin(async (_event, payload) => {
      try {
        const { name, barcode, price, cost, unit, category, minStock } = payload || {};

        const res = await productsService.create({
          name,
          barcode,
          price,
          cost,
          unit,
          category,
          minStock,
        });

        return { ok: true, data: res };
      } catch (err) {
        const msg = err?.message || "Failed to create product";
        const code = msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("barcode")
          ? "DUPLICATE_BARCODE"
          : "PRODUCT_CREATE_ERROR";
        return { ok: false, code, message: msg };
      }
    })
  );

  // UPDATE PRODUCT (admin only)
  ipcMain.handle(
    "products:update",
    requireAdmin(async (_event, payload) => {
      try {
        const { id, patch } = payload || {};
        if (!id) return { ok: false, code: "VALIDATION_ERROR", message: "id is required" };
        if (!patch || typeof patch !== "object") {
          return { ok: false, code: "VALIDATION_ERROR", message: "patch object is required" };
        }

        const res = await productsService.update({ id, patch });
        if (!res) return { ok: false, code: "NOT_FOUND", message: "Product not found" };

        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "PRODUCT_UPDATE_ERROR", message: err?.message || "Failed to update product" };
      }
    })
  );

  // DELETE PRODUCT (admin only)
  ipcMain.handle(
    "products:delete",
    requireAdmin(async (_event, payload) => {
      try {
        const { id } = payload || {};
        if (!id) return { ok: false, code: "VALIDATION_ERROR", message: "id is required" };

        await productsService.remove({ id });
        return { ok: true, data: true };
      } catch (err) {
        return { ok: false, code: "PRODUCT_DELETE_ERROR", message: err?.message || "Failed to delete product" };
      }
    })
  );
}

module.exports = { registerProductsIpc };
