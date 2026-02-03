// backend/repositories/products.repo.js
const { all, get, run } = require("../db");

// Helper: map patch keys safely
function buildPatch(patch) {
  const allowed = ["barcode", "name", "cost", "price", "stock"];
  const sets = [];
  const params = [];

  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      sets.push(`${k}=?`);
      params.push(patch[k]);
    }
  }

  return { sets, params };
}

module.exports = {
  list({ q = "", limit = 200 }) {
    const qq = String(q || "").trim();
    const lim = Math.max(1, Math.min(Number(limit || 200), 1000));

    if (!qq) {
      return all(
        `SELECT * FROM products ORDER BY id DESC LIMIT ?`,
        [lim]
      );
    }

    // search by name or barcode
    return all(
      `SELECT * FROM products
       WHERE name LIKE ? OR barcode LIKE ?
       ORDER BY id DESC
       LIMIT ?`,
      [`%${qq}%`, `%${qq}%`, lim]
    );
  },

  getById({ id }) {
    return get(`SELECT * FROM products WHERE id=?`, [Number(id)]);
  },

  getByBarcode({ barcode }) {
    return get(`SELECT * FROM products WHERE barcode=?`, [String(barcode)]);
  },

  create({ name, barcode, price, cost = 0, stock = 0 }) {
    run(
      `INSERT INTO products (name, barcode, price, cost, stock)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        String(barcode).trim(),
        Number(price),
        Number(cost || 0),
        Number(stock || 0),
      ]
    );

    return this.getByBarcode({ barcode });
  },

  update({ id, patch }) {
    const pid = Number(id);
    const existing = this.getById({ id: pid });
    if (!existing) return null;

    const { sets, params } = buildPatch(patch || {});
    if (sets.length === 0) return existing;

    run(
      `UPDATE products SET ${sets.join(", ")} WHERE id=?`,
      [...params, pid]
    );

    return this.getById({ id: pid });
  },

  remove({ id }) {
    const pid = Number(id);
    const existing = this.getById({ id: pid });
    if (!existing) return false;

    // Safety: if product has sale_items, either block delete or soft-delete.
    // For now, block delete to keep sales history intact.
    const used = get(`SELECT COUNT(*) AS c FROM sale_items WHERE product_id=?`, [pid]);
    if (used && used.c > 0) {
      throw new Error("Cannot delete product: it has sales history");
    }

    run(`DELETE FROM products WHERE id=?`, [pid]);
    return true;
  },

  // Used by stock service (optional helper)
  setStock({ id, stock }) {
    run(`UPDATE products SET stock=? WHERE id=?`, [Number(stock), Number(id)]);
    return this.getById({ id: Number(id) });
  },

  // Low stock helper (simple threshold)
  lowStock({ threshold = 5, limit = 200 }) {
    const th = Number(threshold ?? 5);
    const lim = Math.max(1, Math.min(Number(limit || 200), 1000));

    return all(
      `SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC, id DESC LIMIT ?`,
      [th, lim]
    );
  },
};
