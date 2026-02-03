// backend/repositories/reports.repo.js
const { get, all } = require("../db");

module.exports = {
  summary({ from, to, userId } = {}) {
    let where = `WHERE s.status='PAID'`;
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

  sales({ from, to, userId, limit = 200 } = {}) {
    let where = `WHERE s.status='PAID'`;
    const params = [];

    if (from) { where += ` AND s.created_at >= ?`; params.push(from); }
    if (to)   { where += ` AND s.created_at <= ?`; params.push(to); }
    if (userId) { where += ` AND s.user_id = ?`; params.push(userId); }

    params.push(limit);

    return all(
      `SELECT
         s.id, s.user_id, s.total, s.paid, s.change,
         s.payment_method, s.status, s.created_at,
         s.customer_name, s.customer_phone, s.note
       FROM sales s
       ${where}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ?`,
      params
    );
  },

  topProducts({ from, to, userId, limit = 30 } = {}) {
    let where = `WHERE s.status='PAID'`;
    const params = [];

    if (from) { where += ` AND s.created_at >= ?`; params.push(from); }
    if (to)   { where += ` AND s.created_at <= ?`; params.push(to); }
    if (userId) { where += ` AND s.user_id = ?`; params.push(userId); }

    params.push(limit);

    return all(
      `SELECT
         si.product_id,
         si.name,
         si.barcode,
         IFNULL(SUM(si.qty),0) AS qtySold,
         IFNULL(SUM(si.line_total),0) AS revenue,
         IFNULL(SUM(si.cost * si.qty),0) AS costTotal,
         (IFNULL(SUM(si.line_total),0) - IFNULL(SUM(si.cost * si.qty),0)) AS profit
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       ${where}
       GROUP BY si.product_id, si.name, si.barcode
       ORDER BY qtySold DESC, revenue DESC
       LIMIT ?`,
      params
    );
  },
};
