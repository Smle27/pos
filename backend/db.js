const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DB_FILE = path.join(__dirname, "pos.db");

let SQL = null;
let db = null;

// Transaction support (for atomic stock/sales updates)
let txDepth = 0;
let txDirty = false;

function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      cost REAL DEFAULT 0,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      total REAL NOT NULL,
      payment_method TEXT,
      stock_override INTEGER DEFAULT 0,
      override_user_id INTEGER,
      override_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      product_id INTEGER,
      barcode TEXT,
      name TEXT,
      qty INTEGER,
      price REAL,
      cost REAL DEFAULT 0,
      line_total REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN','CASHIER')),
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      pass_iter INTEGER NOT NULL,
      pass_keylen INTEGER NOT NULL,
      pass_digest TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      meta TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      qty_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_type TEXT,
      ref_id INTEGER,
      user_id INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

        CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      opening_cash REAL DEFAULT 0,
      closing_cash REAL DEFAULT 0,
      note TEXT,
      status TEXT DEFAULT 'OPEN'
    );

  `);

  // Add security columns (no crash if they already exist)
  const addCol = (sql) => {
    try { db.run(sql); } catch (_) {}
  };

  addCol(`ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0`);
  addCol(`ALTER TABLE users ADD COLUMN failed_attempts INTEGER DEFAULT 0`);
  addCol(`ALTER TABLE users ADD COLUMN locked_until INTEGER DEFAULT 0`);
  addCol(`ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1`);

  // Sales / inventory extensions
  addCol(`ALTER TABLE sales ADD COLUMN user_id INTEGER`);
  addCol(`ALTER TABLE sales ADD COLUMN stock_override INTEGER DEFAULT 0`);
  addCol(`ALTER TABLE sales ADD COLUMN override_user_id INTEGER`);
  addCol(`ALTER TABLE sales ADD COLUMN override_reason TEXT`);

  addCol(`ALTER TABLE sale_items ADD COLUMN barcode TEXT`);
  addCol(`ALTER TABLE sale_items ADD COLUMN name TEXT`);
  addCol(`ALTER TABLE sale_items ADD COLUMN cost REAL DEFAULT 0`);
  addCol(`ALTER TABLE sale_items ADD COLUMN line_total REAL DEFAULT 0`);

  // Sales POS fields (held/draft + payments/customer meta)
  addCol(`ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'PAID'`); // HELD | PAID | VOID
  addCol(`ALTER TABLE sales ADD COLUMN customer_name TEXT`);
  addCol(`ALTER TABLE sales ADD COLUMN customer_phone TEXT`);
  addCol(`ALTER TABLE sales ADD COLUMN note TEXT`);
  addCol(`ALTER TABLE sales ADD COLUMN paid REAL DEFAULT 0`);
  addCol(`ALTER TABLE sales ADD COLUMN change REAL DEFAULT 0`);
  addCol(`ALTER TABLE sales ADD COLUMN payments_json TEXT`); // store array payments as JSON

}


function seedDefaultAdmin() {
  const rows = all("SELECT COUNT(*) AS c FROM users");
  if (rows[0].c > 0) return;

  const { hashPassword } = require("./auth");

  const h = hashPassword("admin123"); // change immediately after login
  run(
    `INSERT INTO users
      (username, role, pass_salt, pass_hash, pass_iter, pass_keylen, pass_digest, must_change_password, is_active)
     VALUES
      (?, 'ADMIN', ?, ?, ?, ?, ?, 1, 1)`,
    ["admin", h.salt, h.hash, h.iterations, h.keylen, h.digest]
  );

  run("INSERT INTO audit_log (user_id, action, meta) VALUES (NULL,'SEED_ADMIN',?)",
      [JSON.stringify({ username: "admin" })]);
}



function saveToDisk() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function initDB() {
  if (!SQL) SQL = await initSqlJs();
  if (db) return db;

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
  }

  runMigrations();
  seedDefaultAdmin();


  saveToDisk();
  return db;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  if (txDepth > 0) {
    txDirty = true;
    return;
  }
  saveToDisk();
}


function transaction(fn) {
  // Simple nested transactions support
  const isOuter = txDepth === 0;
  txDepth += 1;

  if (isOuter) {
    db.run("BEGIN");
  }

  try {
    const res = fn();
    txDepth -= 1;

    if (isOuter) {
      db.run("COMMIT");
      if (txDirty) saveToDisk();
      txDirty = false;
    }
    return res;
  } catch (err) {
    txDepth -= 1;

    if (isOuter) {
      try { db.run("ROLLBACK"); } catch (_) {}
      // do not save partial state
      txDirty = false;
    }
    throw err;
  }
}

module.exports = { initDB, all, get, run, transaction };
