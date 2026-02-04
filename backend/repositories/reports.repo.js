// backend/repositories/reports.repo.js
const { initDB, get, all } = require("../db");

async function ensureDb() {
  await initDB();
}

// treat NULL status as PAID for older rows
function paidWhere(alias = "s") {
  return `(${alias}.status IS NULL OR ${alias}.status='PAID')`;
}

module.exports = {
async summary({ from, to, userId } = {}) {
  await ensureDb();

  let where = `WHERE (s.status IS NULL OR s.status='PAID')`;
  const params = [];

  if (from) { where += ` AND s.created_at >= ?`; params.push(from); }
  if (to)   { where += ` AND s.created_at <= ?`; params.push(to); }
  if (userId) { where += ` AND s.user_id = ?`; params.push(userId); }

  const row = get(
    `SELECT
       IFNULL(SUM(s.total),0) AS grossSales,
       COUNT(*) AS transactions
     FROM sales s
     ${where}`,
    params
  );

  return row || { grossSales: 0, transactions: 0 };
},

  async sales({ from, to, userId, limit = 200 } = {}) {
    await ensureDb();

    let where = `WHERE ${paidWhere("s")}`;
    const params = [];

    if (from) { where += ` AND s.created_at >= ?`; params.push(from); }
    if (to)   { where += ` AND s.created_at <= ?`; params.push(to); }
    if (userId) { where += ` AND s.user_id = ?`; params.push(userId); }

    params.push(limit);

    return all(
      `SELECT
         s.id,
         s.user_id,
         u.username AS username,
         s.total,
         s.paid,
         s.change,
         s.payment_method,
         s.status,
         s.created_at,
         s.customer_name,
         s.customer_phone,
         s.note
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ?`,
      params
    );
  },

async topProducts({ from, to, userId, limit = 30 } = {}) {
  await ensureDb();

  let where = `WHERE ${paidWhere("s")}`;
  const params = [];

  if (from) { where += ` AND s.created_at >= ?`; params.push(from); }
  if (to)   { where += ` AND s.created_at <= ?`; params.push(to); }
  if (userId) { where += ` AND s.user_id = ?`; params.push(userId); }

  params.push(limit);

  return all(
    `SELECT
       si.product_id,
       COALESCE(p.name, si.name) AS name,
       COALESCE(p.barcode, si.barcode) AS barcode,
       IFNULL(SUM(si.qty),0) AS qtySold,
       IFNULL(SUM(si.line_total),0) AS revenue,
       IFNULL(SUM(si.cost * si.qty),0) AS costTotal,
       (IFNULL(SUM(si.line_total),0) - IFNULL(SUM(si.cost * si.qty),0)) AS profit
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     LEFT JOIN products p ON p.id = si.product_id
     ${where}
     GROUP BY
       si.product_id,
       COALESCE(p.name, si.name),
       COALESCE(p.barcode, si.barcode)
     ORDER BY revenue DESC, qtySold DESC
     LIMIT ?`,
    params
  );
}
}
