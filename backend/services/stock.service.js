// backend/services/stock.service.js
const stockRepo = require("../repositories/stock.repo");

const ALLOWED_REASONS = new Set([
  'SALE',
  'RETURN',
  'RECEIVE',
  'ADJUST',
  'SET_STOCK',
  'STOCK_OVERRIDE',
  'MOVE',
]);

function normalizeReason(r) {
  const rr = String(r || '').trim().toUpperCase();
  if (!rr) throw new Error('reason is required');
  if (!ALLOWED_REASONS.has(rr)) throw new Error(`Invalid reason: ${rr}`);
  return rr;
}


function must(v, msg) {
  if (v === undefined || v === null || v === "") throw new Error(msg);
}

module.exports = {
  async getStock({ productId }) {
    must(productId, "productId is required");
    return stockRepo.getStock({ productId: Number(productId) });
  },

  async listLow({ threshold = 5, limit = 200, offset = 0 } = {}) {
    const t = Number(threshold);
    if (!Number.isFinite(t) || t < 0) throw new Error("threshold must be >= 0");

    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    const off = Number(offset);
    if (!Number.isFinite(off) || off < 0) throw new Error("offset must be >= 0");

    return stockRepo.listLow({
      threshold: t,
      limit: Math.min(500, Math.floor(lim)),
      offset: Math.floor(off),
    });
  },

  async listMoves({ productId, limit = 200, from, to } = {}) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    return stockRepo.listMoves({
      productId: productId ? Number(productId) : null,
      limit: Math.min(500, Math.floor(lim)),
      from: from || null,
      to: to || null,
    });
  },

  async applyMove({ productId, qtyChange, reason, refType, refId, userId, note }) {
    must(productId, "productId is required");
    must(qtyChange, "qtyChange is required");

    const delta = Number(qtyChange);
    if (!Number.isFinite(delta) || delta === 0) throw new Error("qtyChange must be non-zero");

    // Stock is integer units
    const dInt = Math.trunc(delta);
    if (dInt === 0) throw new Error("qtyChange must be non-zero");

    const rr = normalizeReason(reason);

    return stockRepo.applyMove({
      productId: Number(productId),
      qtyChange: dInt,
      reason: rr,
      refType: refType ? String(refType) : "MANUAL",
      refId: refId != null ? Number(refId) : null,
      userId: userId != null ? Number(userId) : null,
      note: note != null ? String(note) : null,
    });
  },

  async setStock({ productId, newQty, reason, refType, refId, userId, note }) {
    must(productId, "productId is required");
    must(newQty, "newQty is required");

    const target = Number(newQty);
    if (!Number.isFinite(target)) throw new Error("newQty must be a number");
    const tInt = Math.trunc(target);
    if (tInt < 0) throw new Error("Stock cannot go below 0");

    const rr = normalizeReason(reason || "SET_STOCK");

    return stockRepo.setStock({
      productId: Number(productId),
      newQty: tInt,
      reason: rr,
      refType: refType ? String(refType) : "MANUAL",
      refId: refId != null ? Number(refId) : null,
      userId: userId != null ? Number(userId) : null,
      note: note != null ? String(note) : null,
    });
  },
};