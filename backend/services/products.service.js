// backend/services/products.service.js
const productsRepo = require("../repositories/products.repo");

function must(v, msg) {
  if (v === undefined || v === null || v === "") throw new Error(msg);
}

module.exports = {
  async list({ q = "", limit = 200 }) {
    return productsRepo.list({ q, limit });
  },

  async getByBarcode({ barcode }) {
    must(barcode, "barcode is required");
    return productsRepo.getByBarcode({ barcode });
  },

  async create({ name, barcode, price, cost, unit, category, minStock }) {
    must(name, "name is required");
    must(barcode, "barcode is required");
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) throw new Error("price must be > 0");

    return productsRepo.create({
      name,
      barcode,
      price: p,
      cost: cost == null ? 0 : Number(cost),
      unit: unit || "pcs",
      category: category || null,
      minStock: minStock == null ? 0 : Number(minStock),
    });
  },

  async update({ id, patch }) {
    must(id, "id is required");
    return productsRepo.update({ id, patch });
  },

  async remove({ id }) {
    must(id, "id is required");
    return productsRepo.remove({ id });
  },
};
