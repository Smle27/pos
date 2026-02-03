// backend/repositories/stock.repo.js
const { get, all, run, transaction } = require("../db");

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  getStock({ productId }) {
    return get(
      `SELECT id, barcode, name, cost, price, IFNULL(stock,0) AS stock, created_at
       FROM products
       WHERE id=?`,
      [productId]
    );
  },

  listLow({ threshold = 5, limit = 200, offset = 0 }) {
    return all(
      `SELECT id, barcode, name, cost, price, IFNULL(stock,0) AS stock
       FROM products
       WHERE IFNULL(stock,0) <= ?
       ORDER BY stock ASC, name ASC
       LIMIT ? OFFSET ?`,
      [threshold, limit, offset]
    );
  },

  listMoves({ productId, limit = 200, from, to }) {
    let sql = `
      SELECT sm.*, p.name AS product_name, p.barcode AS product_barcode
      FROM stock_moves sm
      LEFT JOIN products p ON p.id = sm.product_id
      WHERE 1=1
    `;
    const params = [];

    if (productId) {
      sql += " AND sm.product_id=?";
      params.push(productId);
    }
    if (from) {
      sql += " AND sm.created_at >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND sm.created_at <= ?";
      params.push(to);
    }

    sql += " ORDER BY sm.created_at DESC, sm.id DESC LIMIT ?";
    params.push(limit);

    return all(sql, params);
  },

  applyMove({ productId, qtyChange, reason, refType, refId, userId, note }) {
    return transaction(() => {
      const p = get("SELECT id, IFNULL(stock,0) AS stock FROM products WHERE id=?", [productId]);
      if (!p) throw new Error("Product not found");

      const delta = Number(qtyChange || 0);
      if (!Number.isFinite(delta) || delta === 0) throw new Error("qtyChange must be non-zero");

      // Always treat stock as integer units
      const dInt = Math.trunc(delta);
      if (dInt === 0) throw new Error("qtyChange must be non-zero");

      const newStock = Number(p.stock || 0) + dInt;
      if (newStock < 0) throw new Error("Stock cannot go below 0");

      run("UPDATE products SET stock=? WHERE id=?", [newStock, productId]);

      run(
        `INSERT INTO stock_moves (product_id, qty_change, reason, ref_type, ref_id, user_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          dInt,
          String(reason || "MOVE"),
          refType || "MANUAL",
          refId ?? null,
          userId ?? null,
          note ?? null,
          nowIso(),
        ]
      );

      // Lightweight audit trail (useful for admin adjustments)
      try {
        run(
          `INSERT INTO audit_log (user_id, action, meta, created_at)
           VALUES (?, ?, ?, ?)`,
          [
            userId ?? null,
            "STOCK_MOVE",
            JSON.stringify({
              productId,
              qtyChange: dInt,
              reason: String(reason || "MOVE"),
              refType: refType || "MANUAL",
              refId: refId ?? null,
              note: note ?? null,
            }),
            nowIso(),
          ]
        );
      } catch (_) {
        // ignore audit failure (never block stock)
      }

      return this.getStock({ productId });
    });
  },

  setStock({ productId, newQty, reason, refType, refId, userId, note }) {
    // applyMove already runs in a transaction; keep this logic clean
    const p = get("SELECT id, IFNULL(stock,0) AS stock FROM products WHERE id=?", [productId]);
    if (!p) throw new Error("Product not found");

    const target = Number(newQty);
    if (!Number.isFinite(target)) throw new Error("newQty must be a number");
    const tInt = Math.trunc(target);
    if (tInt < 0) throw new Error("Stock cannot go below 0");

    const delta = tInt - Number(p.stock || 0);
    if (delta === 0) return this.getStock({ productId });

    return this.applyMove({
      productId,
      qtyChange: delta,
      reason: reason || "SET_STOCK",
      refType: refType || "MANUAL",
      refId,
      userId,
      note,
    });
  },
};
