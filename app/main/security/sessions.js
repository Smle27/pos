const crypto = require("crypto");
const store = require("../store");

const SESSION_KEY = "sessions.v1";

// POS-friendly timeouts
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IDLE_MS = 8 * 60 * 60 * 1000;         // 8 hours

let sessions = new Map();

function now() {
  return Date.now();
}

function load() {
  try {
    const raw = store.get(SESSION_KEY, []);
    sessions = new Map(raw.map((s) => [s.token, s]));
  } catch (_) {
    sessions = new Map();
  }
}

function save() {
  try {
    store.set(SESSION_KEY, Array.from(sessions.values()));
  } catch (_) {}
}

function cleanup() {
  const t = now();
  for (const [token, s] of sessions.entries()) {
    const createdAt = s.createdAt || 0;
    const lastSeen = s.lastSeen || 0;

    if (t - createdAt > MAX_AGE_MS) {
      sessions.delete(token);
      continue;
    }
    if (t - lastSeen > IDLE_MS) {
      sessions.delete(token);
      continue;
    }
  }
  save();
}

function initSessions() {
  load();
  cleanup();
  setInterval(cleanup, 60 * 1000);
}

// createSession(user) -> returns token string (matches auth.ipc.js)
function createSession(user) {
  const token = crypto.randomUUID();
  const t = now();

  const session = {
    token,
    user,
    createdAt: t,
    lastSeen: t,
  };

  sessions.set(token, session);
  save();
  return token;
}

function getSession(token) {
  if (!token || typeof token !== "string") return null;

  const s = sessions.get(token);
  if (!s) return null;

  const t = now();

  if (t - (s.createdAt || 0) > MAX_AGE_MS) {
    sessions.delete(token);
    save();
    return null;
  }
  if (t - (s.lastSeen || 0) > IDLE_MS) {
    sessions.delete(token);
    save();
    return null;
  }

  s.lastSeen = t;
  sessions.set(token, s);
  save();
  return s;
}

function destroySession(token) {
  if (!token || typeof token !== "string") return;
  sessions.delete(token);
  save();
}

module.exports = {
  initSessions,
  createSession,
  getSession,
  destroySession,
};
