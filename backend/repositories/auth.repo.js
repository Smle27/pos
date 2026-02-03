// backend/repositories/auth.repo.js
const { get, run } = require("../db");

module.exports = {
  getUserByUsername(username) {
    return get(`SELECT * FROM users WHERE username=?`, [username]);
  },

  setFailedAttempts(userId, n) {
    run(`UPDATE users SET failed_attempts=? WHERE id=?`, [n, userId]);
  },

  setLockedUntil(userId, ts) {
    run(`UPDATE users SET locked_until=? WHERE id=?`, [ts, userId]);
  },

  touchAudit(userId, action, metaObj) {
    run(
      `INSERT INTO audit_log (user_id, action, meta) VALUES (?, ?, ?)`,
      [userId ?? null, String(action), metaObj ? JSON.stringify(metaObj) : null]
    );
  },
};
