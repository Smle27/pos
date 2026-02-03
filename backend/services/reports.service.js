// backend/services/reports.service.js
const reportsRepo = require("../repositories/reports.repo");

function must(v, msg) {
  if (v === undefined || v === null || v === "") throw new Error(msg);
}

module.exports = {
  async summary({ from, to, userId } = {}) {
    // from/to can be ISO strings; keep light validation
    return reportsRepo.summary({ from: from || null, to: to || null, userId: userId ? Number(userId) : null });
  },

  async sales({ from, to, userId, limit = 200 } = {}) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    return reportsRepo.sales({
      from: from || null,
      to: to || null,
      userId: userId ? Number(userId) : null,
      limit: Math.min(500, Math.floor(lim)),
    });
  },

  async topProducts({ from, to, userId, limit = 30 } = {}) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    return reportsRepo.topProducts({
      from: from || null,
      to: to || null,
      userId: userId ? Number(userId) : null,
      limit: Math.min(200, Math.floor(lim)),
    });
  },
};
