// backend/services/users.service.js
const { initDB, all, get, run } = require("../db");
const { hashPassword } = require("../auth"); // uses PBKDF2 fields your users table already has

function normalizeRole(role) {
  const r = String(role || "").toUpperCase().trim();
  if (r !== "ADMIN" && r !== "CASHIER") return "CASHIER";
  return r;
}

async function ensureDb() {
  await initDB();
}

// Return safe user object (no password fields)
function toUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    is_active: row.is_active ?? 1,
    must_change_password: row.must_change_password ?? 0,
    failed_attempts: row.failed_attempts ?? 0,
    locked_until: row.locked_until ?? 0,
    created_at: row.created_at,
  };
}

async function listUsers({ q, limit } = {}) {
  await ensureDb();

  const term = (q || "").trim();
  const lim = Math.min(Math.max(parseInt(limit || 200, 10), 1), 500);

  let rows = [];
  if (term) {
    rows = all(
      `
      SELECT id, username, role, is_active, must_change_password, failed_attempts, locked_until, created_at
      FROM users
      WHERE username LIKE ?
      ORDER BY id DESC
      LIMIT ?
    `,
      [`%${term}%`, lim]
    );
  } else {
    rows = all(
      `
      SELECT id, username, role, is_active, must_change_password, failed_attempts, locked_until, created_at
      FROM users
      ORDER BY id DESC
      LIMIT ?
    `,
      [lim]
    );
  }

  return rows.map(toUserRow);
}

async function createUser({ username, password, role } = {}) {
  await ensureDb();

  const u = (username || "").trim();
  const p = String(password || "").trim();
  const r = normalizeRole(role);

  if (!u) throw new Error("Username is required");
  if (!p) throw new Error("Password is required");
  if (p.length < 4) throw new Error("Password too short (min 4)");

  const existing = get(`SELECT id FROM users WHERE username = ?`, [u]);
  if (existing) throw new Error("Username already exists");

  const h = hashPassword(p);

  run(
    `
    INSERT INTO users
      (username, role, pass_salt, pass_hash, pass_iter, pass_keylen, pass_digest, must_change_password, is_active)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 1, 1)
  `,
    [u, r, h.salt, h.hash, h.iterations, h.keylen, h.digest]
  );

  const row = get(
    `
    SELECT id, username, role, is_active, must_change_password, failed_attempts, locked_until, created_at
    FROM users
    WHERE username = ?
  `,
    [u]
  );

  return toUserRow(row);
}

async function resetUserPassword({ userId, newPassword } = {}) {
  await ensureDb();

  const id = parseInt(userId, 10);
  const p = String(newPassword || "").trim();

  if (!id) throw new Error("userId is required");
  if (!p) throw new Error("newPassword is required");
  if (p.length < 4) throw new Error("Password too short (min 4)");

  const row0 = get(`SELECT id FROM users WHERE id = ?`, [id]);
  if (!row0) throw new Error("User not found");

  const h = hashPassword(p);

  run(
    `
    UPDATE users
    SET pass_salt = ?, pass_hash = ?, pass_iter = ?, pass_keylen = ?, pass_digest = ?,
        must_change_password = 1,
        failed_attempts = 0,
        locked_until = 0
    WHERE id = ?
  `,
    [h.salt, h.hash, h.iterations, h.keylen, h.digest, id]
  );

  const row = get(
    `
    SELECT id, username, role, is_active, must_change_password, failed_attempts, locked_until, created_at
    FROM users
    WHERE id = ?
  `,
    [id]
  );

  return toUserRow(row);
}

async function setUserActive({ userId, isActive } = {}) {
  await ensureDb();

  const id = parseInt(userId, 10);
  if (!id) throw new Error("userId is required");

  const active = isActive ? 1 : 0;

  const row0 = get(`SELECT id FROM users WHERE id = ?`, [id]);
  if (!row0) throw new Error("User not found");

  run(`UPDATE users SET is_active = ? WHERE id = ?`, [active, id]);

  const row = get(
    `
    SELECT id, username, role, is_active, must_change_password, failed_attempts, locked_until, created_at
    FROM users
    WHERE id = ?
  `,
    [id]
  );

  return toUserRow(row);
}

module.exports = {
  listUsers,
  createUser,
  resetUserPassword,
  setUserActive,
};
