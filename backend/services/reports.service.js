// backend/services/reports.service.js
const reportsRepo = require("../repositories/reports.repo");

function toRange(from, to) {
  // Accept "YYYY-MM-DD" or full timestamps
  const norm = (s) => (s && String(s).trim() ? String(s).trim() : null);

  const f = norm(from);
  const t = norm(to);

  // If user passes date-only, expand to day range
  const fromOut = f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? `${f} 00:00:00` : f;
  const toOut = t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t} 23:59:59` : t;

  return { from: fromOut, to: toOut };
}

module.exports = {
  async summary({ from, to, userId } = {}) {
    const r = toRange(from, to);
    return await reportsRepo.summary({
      from: r.from,
      to: r.to,
      userId: userId ? Number(userId) : null,
    });
  },

  async sales({ from, to, userId, limit = 200 } = {}) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    const r = toRange(from, to);

    return await reportsRepo.sales({
      from: r.from,
      to: r.to,
      userId: userId ? Number(userId) : null,
      limit: Math.min(500, Math.floor(lim)),
    });
  },

  async topProducts({ from, to, userId, limit = 30 } = {}) {
    const lim = Number(limit);
    if (!Number.isFinite(lim) || lim <= 0) throw new Error("limit must be > 0");

    const r = toRange(from, to);

    return await reportsRepo.topProducts({
      from: r.from,
      to: r.to,
      userId: userId ? Number(userId) : null,
      limit: Math.min(200, Math.floor(lim)),
    });
  },
};
