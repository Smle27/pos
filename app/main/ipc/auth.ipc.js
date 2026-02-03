// app/main/ipc/auth.ipc.js
const { ipcMain } = require("electron");
const { createSession, destroySession } = require("../security/sessions");
const { requireAuth } = require("../security/permissions");

// Use your existing auth service here
const authService = require("../../../backend/services/auth.service");

function registerAuthIpc() {

    // LOGIN
  ipcMain.handle("auth:login", async (_event, { username, password } = {}) => {
    try {
      if (!username || !password) {
        return { ok: false, code: "VALIDATION_ERROR", message: "username & password required" };
      }

      const user = await authService.login(username, password);

      if (!user) {
        return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid login" };
      }

      const token = createSession({
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });

      return {
        ok: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
          },
        },
      };
    } catch (err) {
      return { ok: false, code: "AUTH_ERROR", message: err?.message || "Auth error" };
    }
  });

  // LOGOUT
  ipcMain.handle(
    "auth:logout",
    requireAuth((_event, { token }) => {
      destroySession(token);
      return { ok: true };
    })
  );



  // CURRENT USER
  ipcMain.handle(
    "auth:me",
    requireAuth((_event, _payload, session) => {
      return {
        ok: true,
        data: {
          user: session.user,
        },
      };
    })
  );

    ipcMain.handle("auth:debugUsers", async () => {
  const { all } = require("../../../backend/db");
  return { ok: true, data: all("SELECT id, username, role, is_active, must_change_password FROM users") };
});

}

module.exports = { registerAuthIpc };
