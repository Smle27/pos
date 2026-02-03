// backend/services/auth.service.js
const authRepo = require("../repositories/auth.repo");
const { verifyPassword } = require("../auth");

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

function sanitizeUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    mustChangePassword: Number(u.must_change_password || 0) === 1,
  };
}

function toVerifierShape(u) {
  return {
    salt: u.pass_salt,
    hash: u.pass_hash,
    iterations: Number(u.pass_iter),
    keylen: Number(u.pass_keylen),
    digest: u.pass_digest,
  };
}

module.exports = {
  async login(username, password) {
    if (!username || !password) return null;

    const u = authRepo.getUserByUsername(String(username));
    if (!u) return null;

    if (u.is_active !== undefined && Number(u.is_active) === 0) {
      throw new Error("Account is inactive");
    }

    const now = Date.now();
    const lockedUntil = Number(u.locked_until || 0);
    if (lockedUntil && lockedUntil > now) {
      const secs = Math.ceil((lockedUntil - now) / 1000);
      throw new Error(`Account locked. Try again in ${secs}s`);
    }

    // ✅ IMPORTANT: map DB fields to verifyPassword expected keys
    const ok = verifyPassword(String(password), toVerifierShape(u));

    if (!ok) {
      const attempts = Number(u.failed_attempts || 0) + 1;
      authRepo.setFailedAttempts(u.id, attempts);

      if (attempts >= MAX_ATTEMPTS) {
        const until = now + LOCK_MINUTES * 60 * 1000;
        authRepo.setLockedUntil(u.id, until);
        authRepo.touchAudit(u.id, "AUTH_LOCKED", { attempts, until });
        throw new Error(`Too many attempts. Locked for ${LOCK_MINUTES} minutes`);
      }

      return null;
    }

    // reset counters on success
    if (Number(u.failed_attempts || 0) !== 0) authRepo.setFailedAttempts(u.id, 0);
    if (Number(u.locked_until || 0) !== 0) authRepo.setLockedUntil(u.id, 0);

    authRepo.touchAudit(u.id, "AUTH_LOGIN", { username: u.username });

    return sanitizeUser(u);
  },
};
