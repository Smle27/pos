// backend/repositories/sales.repo.js
const { get, all, run, transaction } = require("../db");
const stockRepo = require("./stock.repo");

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  // --- Product helper (local to repo) ---
  getProductById(productId) {
    return get(
      `SELECT id, barcode, name, price, cost, IFNULL(stock,0) AS stock
       FROM products WHERE id=?`,
      [productId]
    );
  },

  // --- Sale CRUD ---
  createSaleRow({
    userId,
    total,
    paymentMethod,
    paid,
    change,
    status,
    customerName,
    customerPhone,
    note,
    paymentsJson,
    stockOverride = 0,
    overrideUserId = null,
    overrideReason = null,
  }) {
    run(
      `INSERT INTO sales
       (user_id, total, payment_method, paid, change, status,
        customer_name, customer_phone, note, payments_json,
        stock_override, override_user_id, override_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        total,
        paymentMethod ?? null,
        paid ?? 0,
        change ?? 0,
        status || "PAID",
        customerName ?? null,
        customerPhone ?? null,
        note ?? null,
        paymentsJson ?? null,
        stockOverride ? 1 : 0,
        overrideUserId ?? null,
        overrideReason ?? null,
        nowIso(),
      ]
    );

    const row = get("SELECT last_insert_rowid() AS id");
    return row?.id;
  },

  insertSaleItem({ saleId, product, qty, price }) {
    const q = Number(qty || 0);
    const p = Number(price || 0);

    const lineTotal = p * q;

    run(
      `INSERT INTO sale_items
        (sale_id, product_id, barcode, name, qty, price, cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        product.id,
        product.barcode || null,
        product.name || null,
        q,
        p,
        Number(product.cost || 0),
        lineTotal,
      ]
    );

    return { lineTotal };
  },

  deleteSaleItems(saleId) {
    run(`DELETE FROM sale_items WHERE sale_id=?`, [saleId]);
  },

  listSaleItems(saleId) {
    return all(
      `SELECT id, sale_id, product_id, barcode, name, qty, price, cost, line_total
       FROM sale_items
       WHERE sale_id=?
       ORDER BY id ASC`,
      [saleId]
    );
  },

  getSale(saleId) {
    return get(
      `SELECT *
       FROM sales
       WHERE id=?`,
      [saleId]
    );
  },

  getSaleWithItems(saleId) {
    const sale = this.getSale(saleId);
    if (!sale) return null;
    const items = this.listSaleItems(saleId);
    return { sale, items };
  },

  listRecentSales({ limit = 100, from, to, status } = {}) {
    let sql = `SELECT * FROM sales WHERE 1=1`;
    const params = [];
    if (status) {
      sql += ` AND status=?`;
      params.push(status);
    }
    if (from) {
      sql += ` AND created_at >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND created_at <= ?`;
      params.push(to);
    }
    sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
    params.push(limit);
    return all(sql, params);
  },

  listHeldSales({ userId = null, limit = 50 } = {}) {
    if (userId) {
      return all(
        `SELECT * FROM sales
         WHERE status='HELD' AND user_id=?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
    }
    return all(
      `SELECT * FROM sales
       WHERE status='HELD'
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
  },

  setSaleStatus({ saleId, status }) {
    run(`UPDATE sales SET status=? WHERE id=?`, [status, saleId]);
    return this.getSale(saleId);
  },

  updateSalePayment({
    saleId,
    status = "PAID",
    total,
    paymentMethod,
    paid,
    change,
    paymentsJson,
    customerName,
    customerPhone,
    note,
    stockOverride = 0,
    overrideUserId = null,
    overrideReason = null,
  }) {
    run(
      `UPDATE sales SET
        status=?,
        total=?,
        payment_method=?,
        paid=?,
        change=?,
        payments_json=?,
        customer_name=?,
        customer_phone=?,
        note=?,
        stock_override=?,
        override_user_id=?,
        override_reason=?
       WHERE id=?`,
      [
        status,
        total,
        paymentMethod ?? null,
        paid ?? 0,
        change ?? 0,
        paymentsJson ?? null,
        customerName ?? null,
        customerPhone ?? null,
        note ?? null,
        stockOverride ? 1 : 0,
        overrideUserId ?? null,
        overrideReason ?? null,
        saleId,
      ]
    );
    return this.getSale(saleId);
  },

  // Atomic checkout: sale row + items + (optional) stock deduction/moves
  checkoutAtomic({
    userId,
    status,
    total,
    paymentMethod,
    paid,
    change,
    paymentsJson,
    customerName,
    customerPhone,
    note,
    lines,
    allowOverride = false,
    overrideUserId = null,
    overrideReason = null,
    saleId = null,
  }) {
    return transaction(() => {
      let sid = saleId ? Number(saleId) : null;

      if (sid) {
        const existing = this.getSale(sid);
        if (!existing) throw new Error("Sale not found");
        if (existing.status !== "HELD") throw new Error("Only HELD sales can be checked out");

        // Replace held items with current cart (ensures correct totals)
        this.deleteSaleItems(sid);
      } else {
        sid = this.createSaleRow({
          userId,
          total,
          paymentMethod,
          paid,
          change,
          status,
          customerName,
          customerPhone,
          note,
          paymentsJson,
          stockOverride: allowOverride ? 1 : 0,
          overrideUserId,
          overrideReason,
        });
      }

      // Insert items
      for (const l of lines) {
        this.insertSaleItem({ saleId: sid, product: l.product, qty: l.qty, price: l.price });
      }

      // Update payment fields (also sets override columns)
      this.updateSalePayment({
        saleId: sid,
        status,
        total,
        paymentMethod,
        paid,
        change,
        paymentsJson,
        customerName,
        customerPhone,
        note,
        stockOverride: allowOverride ? 1 : 0,
        overrideUserId,
        overrideReason,
      });

      // Deduct stock (unless override)
      if (allowOverride) {
        // Log override marker (no qty change)
        for (const l of lines) {
          stockRepo.applyMove({
            productId: l.product.id,
            qtyChange: 0,
            reason: "STOCK_OVERRIDE",
            refType: "SALE",
            refId: sid,
            userId,
            note: overrideReason || "override",
          });
        }
      } else {
        for (const l of lines) {
          stockRepo.applyMove({
            productId: l.product.id,
            qtyChange: -l.qty,
            reason: "SALE",
            refType: "SALE",
            refId: sid,
            userId,
            note: null,
          });
        }
      }

      return this.getSaleWithItems(sid);
    });
  },

  // Void PAID sale and restock items (admin)
  voidPaidAtomic({ saleId, userId, note }) {
    return transaction(() => {
      const bundle = this.getSaleWithItems(Number(saleId));
      if (!bundle) throw new Error("Sale not found");
      if (bundle.sale.status !== "PAID") throw new Error("Only PAID sales can be voided");

      // Mark void
      this.setSaleStatus({ saleId: Number(saleId), status: "VOID" });

      // Restock (unless it was override; in that case there was no deduction)
      const wasOverride = Number(bundle.sale.stock_override || 0) === 1;
      if (!wasOverride) {
        for (const it of bundle.items || []) {
          stockRepo.applyMove({
            productId: it.product_id,
            qtyChange: Number(it.qty || 0),
            reason: "RETURN",
            refType: "VOID",
            refId: Number(saleId),
            userId,
            note: note || "void paid sale",
          });
        }
      } else {
        // Still log a move marker for audit
        for (const it of bundle.items || []) {
          stockRepo.applyMove({
            productId: it.product_id,
            qtyChange: 0,
            reason: "MOVE",
            refType: "VOID",
            refId: Number(saleId),
            userId,
            note: note || "void override sale",
          });
        }
      }

      // Add audit record (best-effort)
      try {
        run(
          `INSERT INTO audit_log (user_id, action, meta, created_at)
           VALUES (?, ?, ?, ?)` ,
          [
            userId ?? null,
            "VOID_SALE",
            JSON.stringify({ saleId: Number(saleId), note: note || null }),
            nowIso(),
          ]
        );
      } catch (_) {}

      return true;
    });
  },
};
