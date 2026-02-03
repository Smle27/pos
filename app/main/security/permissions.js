// app/main/security/permissions.js
const { getSession } = require("./sessions");

function requireAuth(handler) {
  return async (event, payload) => {
    const token = payload?.token;
    const session = getSession(token);

    if (!session) {
      return { ok: false, code: "NOT_AUTHENTICATED", message: "Session expired" };
    }

    return handler(event, payload, session);
  };
}

function requireAdmin(handler) {
  return requireAuth((event, payload, session) => {
    if (session.user.role !== "ADMIN") {
      return { ok: false, code: "FORBIDDEN", message: "Admin only" };
    }
    return handler(event, payload, session);
  });
}

function requireCashier(handler) {
  return requireAuth((event, payload, session) => {
    if (!["CASHIER", "ADMIN"].includes(session.user.role)) {
      return { ok: false, code: "FORBIDDEN", message: "Cashier only" };
    }
    return handler(event, payload, session);
  });
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireCashier,
};
