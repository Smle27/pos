// app/main/ipc/users.ipc.js
const { ipcMain } = require("electron");
const { requireAdmin } = require("../security/permissions");

const usersService = require("../../../backend/services/users.service");

function registerUsersIpc() {
  ipcMain.handle(
    "users:list",
    requireAdmin(async (_e, payload) => {
      try {
        const res = await usersService.listUsers(payload || {});
        return { ok: true, data: res || [] };
      } catch (err) {
        return { ok: false, code: "USERS_LIST_ERROR", message: err?.message || "Failed to list users" };
      }
    })
  );

  ipcMain.handle(
    "users:create",
    requireAdmin(async (_e, payload) => {
      try {
        const { username, role, password } = payload || {};
        if (!username || !password) {
          return { ok: false, code: "VALIDATION_ERROR", message: "username & password required" };
        }
        const res = await usersService.createUser({ username, role, password });
        return { ok: true, data: res };
      } catch (err) {
        const msg = err?.message || "Failed to create user";
        const lower = msg.toLowerCase();
        const code =
          lower.includes("exists") || lower.includes("unique") || lower.includes("username")
            ? "DUPLICATE_USERNAME"
            : "USERS_CREATE_ERROR";
        return { ok: false, code, message: msg };
      }
    })
  );

  ipcMain.handle(
    "users:resetPassword",
    requireAdmin(async (_e, payload) => {
      try {
        const { userId, newPassword } = payload || {};
        if (!userId || !newPassword) {
          return { ok: false, code: "VALIDATION_ERROR", message: "userId & newPassword required" };
        }
        const res = await usersService.resetUserPassword({ userId, newPassword });
        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "USERS_RESET_ERROR", message: err?.message || "Failed to reset password" };
      }
    })
  );

  ipcMain.handle(
    "users:setActive",
    requireAdmin(async (_e, payload) => {
      try {
        const { userId, active } = payload || {};
        if (!userId || typeof active !== "boolean") {
          return { ok: false, code: "VALIDATION_ERROR", message: "userId & active(boolean) required" };
        }
        const res = await usersService.setUserActive({ userId, isActive: active });
        return { ok: true, data: res };
      } catch (err) {
        return { ok: false, code: "USERS_ACTIVE_ERROR", message: err?.message || "Failed to update user" };
      }
    })
  );
}

module.exports = { registerUsersIpc };
