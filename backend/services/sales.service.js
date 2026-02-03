// backend/services/sales.service.js
const salesRepo = require("../repositories/sales.repo");
const { transaction } = require("../db");

function must(v, msg) {
  if (v === undefined || v === null || v === "") throw new Error(msg);
}

function num(v, msg) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(msg);
  return n;
}

function normCart(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error("Cart is empty");

  return cartItems.map((it) => {
    must(it.productId, "productId is required");
    const qty = num(it.qty, "qty must be a number");
    if (qty <= 0) throw new Error("qty must be > 0");

    // price is optional; if missing we use product.price
    const hasPrice = it.price !== undefined && it.price !== null && it.price !== "";
    const price = hasPrice ? num(it.price, "price must be a number") : null;

    return {
      productId: Number(it.productId),
      qty: Math.floor(qty),
      price,
    };
  });
}

async function buildLines(cartItems) {
  const items = normCart(cartItems);

  const lines = [];
  for (const it of items) {
    const p = salesRepo.getProductById(it.productId);
    if (!p) throw new Error(`Product not found: ${it.productId}`);

    const unitPrice = it.price != null ? it.price : Number(p.price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("Invalid product price");

    lines.push({
      product: p,
      qty: it.qty,
      price: unitPrice,
      lineTotal: unitPrice * it.qty,
    });
  }
  return lines;
}

function calcTotals(lines) {
  const total = lines.reduce((sum, l) => sum + Number(l.lineTotal || 0), 0);
  return { total };
}

function calcPayments(payments) {
  if (!Array.isArray(payments) || payments.length === 0) throw new Error("Payment is required");

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  if (!Number.isFinite(totalPaid) || totalPaid <= 0) throw new Error("Invalid payment amount");

  // keep "payment_method" compatible: use first method
  const method = payments[0]?.method || "CASH";
  return { totalPaid, method, paymentsJson: JSON.stringify(payments) };
}

async function checkStock(lines, allowOverride) {
  if (allowOverride) return;

  for (const l of lines) {
    const stock = Number(l.product.stock || 0);
    if (stock < l.qty) {
      throw new Error(`Out of stock: ${l.product.name} (have ${stock}, need ${l.qty})`);
    }
  }
}

function mustAdminOverride(meta) {
  if (!meta?.stockOverride) return;
  if (!meta?.overrideReason) throw new Error("overrideReason is required for stockOverride");
  if (!meta?.overrideUserId) throw new Error("overrideUserId is required for stockOverride");
}

module.exports = {
  // Create HELD sale (no stock deduction)
  async holdSale(cartItems, meta = {}) {
    const lines = await buildLines(cartItems);
    const { total } = calcTotals(lines);

    const userId = meta.userId ?? null;
    const customerName = meta.customer?.name ?? null;
    const customerPhone = meta.customer?.phone ?? null;
    const note = meta.note ?? null;

    return transaction(() => {
      const saleId = salesRepo.createSaleRow({
        userId,
        total,
        paymentMethod: null,
        paid: 0,
        change: 0,
        status: "HELD",
        customerName,
        customerPhone,
        note,
        paymentsJson: null,
      });

      for (const l of lines) {
        salesRepo.insertSaleItem({ saleId, product: l.product, qty: l.qty, price: l.price });
      }

      return salesRepo.getSaleWithItems(saleId);
    });
  },

  async getSale(saleId) {
    must(saleId, "saleId is required");
    return salesRepo.getSaleWithItems(Number(saleId));
  },

  async listHeldSales({ userId, limit = 50 } = {}) {
    return salesRepo.listHeldSales({ userId: userId ? Number(userId) : null, limit: Number(limit || 50) });
  },

  async listRecentSales({ limit = 100, from, to, status } = {}) {
    return salesRepo.listRecentSales({
      limit: Math.min(500, Number(limit || 100)),
      from: from ? String(from) : null,
      to: to ? String(to) : null,
      status: status ? String(status) : null,
    });
  },

  // Checkout from cartItems (optionally converting held sale via saleId)
  async checkout(cartItems, meta = {}) {
    const lines = await buildLines(cartItems);
    const { total } = calcTotals(lines);

    const { totalPaid, method, paymentsJson } = calcPayments(meta.payments);

    // override flow (optional)
    const allowOverride = !!meta.stockOverride;
    mustAdminOverride(meta);
    await checkStock(lines, allowOverride);

    const userId = meta.userId ?? null;
    const customerName = meta.customer?.name ?? null;
    const customerPhone = meta.customer?.phone ?? null;
    const note = meta.note ?? null;

    const change = totalPaid - total;
    if (change < 0) throw new Error("Insufficient payment");

    const saleId = meta.saleId ? Number(meta.saleId) : null;

    const bundle = salesRepo.checkoutAtomic({
      userId,
      status: "PAID",
      total,
      paymentMethod: method,
      paid: totalPaid,
      change,
      paymentsJson,
      customerName,
      customerPhone,
      note,
      lines,
      allowOverride,
      overrideUserId: meta.overrideUserId ?? null,
      overrideReason: meta.overrideReason ?? null,
      saleId,
    });

    return {
      saleId: bundle?.sale?.id ?? saleId,
      total,
      paid: totalPaid,
      change,
      paymentMethod: method,
      ...bundle,
    };
  },

  async checkoutSale(saleId, meta = {}) {
    must(saleId, "saleId is required");

    const bundle = salesRepo.getSaleWithItems(Number(saleId));
    if (!bundle) throw new Error("Sale not found");
    if (bundle.sale.status !== "HELD") throw new Error("Only HELD sales can be checked out");

    // Build lines from held items
    const heldItems = (bundle.items || []).map((it) => ({
      productId: it.product_id,
      qty: it.qty,
      price: it.price,
    }));

    return this.checkout(heldItems, { ...meta, saleId: Number(saleId) });
  },

  async voidSale(saleId, meta = {}) {
    must(saleId, "saleId is required");
    const sale = salesRepo.getSale(Number(saleId));
    if (!sale) throw new Error("Sale not found");

    // Only void HELD (no stock already deducted)
    if (sale.status !== "HELD") throw new Error("Only HELD sales can be voided");

    salesRepo.setSaleStatus({ saleId: Number(saleId), status: "VOID" });
    return true;
  },

  async voidPaidSale(saleId, meta = {}) {
    must(saleId, "saleId is required");
    return salesRepo.voidPaidAtomic({
      saleId: Number(saleId),
      userId: meta.userId ?? null,
      note: meta.note ?? null,
    });
  },
};
