// app/main/store.js
const fs = require("fs");
const path = require("path");

// IMPORTANT:
// When packaged, __dirname may be inside an .asar (read-only).
// Store runtime settings under Electron userData instead.
function resolveStoreFile() {
  try {
    // Lazy require (works even if called before app ready)
    const { app } = require("electron");
    const base = app?.getPath?.("userData");
    if (base) {
      const dir = path.join(base, "pos-desktop");
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
      return path.join(dir, "store.json");
    }
  } catch (_) {}

  // Dev fallback: keep it alongside the code
  return path.join(__dirname, "store.json");
}

const STORE_FILE = resolveStoreFile();

let cache = null;

function load() {
  if (cache) return cache;

  try {
    if (fs.existsSync(STORE_FILE)) {
      const txt = fs.readFileSync(STORE_FILE, "utf8");
      cache = txt ? JSON.parse(txt) : {};
    } else {
      cache = {};
      fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2));
    }
  } catch (e) {
    // If JSON is corrupted or disk error, recover safely
    cache = {};
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2));
    } catch (_) {}
  }

  return cache;
}

function save() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(cache || {}, null, 2));
  } catch (e) {
    // do nothing (avoid crashing app)
  }
}

function get(key, defVal = undefined) {
  const data = load();
  return key in data ? data[key] : defVal;
}

function set(key, value) {
  const data = load();
  data[key] = value;
  cache = data;
  save();
  return true;
}

function remove(key) {
  const data = load();
  delete data[key];
  cache = data;
  save();
  return true;
}

module.exports = { get, set, remove };
