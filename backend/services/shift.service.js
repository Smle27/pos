// backend/services/shift.service.js
const shiftRepo = require("../repositories/shift.repo");

function must(v, msg) {
  if (v === undefined || v === null || v === "") throw new Error(msg);
}

module.exports = {
  async myOpen({ userId }) {
    must(userId, "userId is required");
    return shiftRepo.getOpenByUserId(Number(userId));
  },

  async open({ userId, openingCash = 0, note = null }) {
    must(userId, "userId is required");

    const existing = shiftRepo.getOpenByUserId(Number(userId));
    if (existing) throw new Error("You already have an open shift");

    return shiftRepo.open({
      userId: Number(userId),
      openingCash: Number(openingCash || 0),
      note: note || null,
    });
  },

  async close({ userId, closingCash = 0, note = null }) {
    must(userId, "userId is required");

    const open = shiftRepo.getOpenByUserId(Number(userId));
    if (!open) throw new Error("No open shift found");

    return shiftRepo.close({
      shiftId: open.id,
      closingCash: Number(closingCash || 0),
      note: note || null,
    });
  },

  async list({ limit = 200 } = {}) {
    return shiftRepo.list({ limit });
  },
};
