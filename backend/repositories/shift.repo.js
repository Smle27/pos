// backend/repositories/shift.repo.js
const { get, all, run } = require("../db");

module.exports = {
  getOpenByUserId(userId) {
    return get(
      `SELECT * FROM shifts WHERE user_id=? AND status='OPEN' ORDER BY id DESC LIMIT 1`,
      [userId]
    );
  },

  getById(id) {
    return get(`SELECT * FROM shifts WHERE id=?`, [id]);
  },

  open({ userId, openingCash = 0, note = null }) {
    run(
      `INSERT INTO shifts (user_id, opening_cash, note, status)
       VALUES (?, ?, ?, 'OPEN')`,
      [userId, Number(openingCash || 0), note]
    );
    return get(`SELECT * FROM shifts WHERE id=last_insert_rowid()`);
  },

  close({ shiftId, closingCash = 0, note = null }) {
    run(
      `UPDATE shifts
       SET closing_cash=?, note=COALESCE(?, note), closed_at=CURRENT_TIMESTAMP, status='CLOSED'
       WHERE id=? AND status='OPEN'`,
      [Number(closingCash || 0), note, shiftId]
    );
    return this.getById(shiftId);
  },

  list({ limit = 200 } = {}) {
    return all(
      `SELECT * FROM shifts ORDER BY id DESC LIMIT ?`,
      [Math.min(500, Number(limit || 200))]
    );
  },
};
