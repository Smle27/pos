// app/renderer/pages/login/login.js
// Fixes:
// - Correct form id (loginForm)
// - Prevents null addEventListener crash
// - Auto-redirects if already authenticated

function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user || {}));
}

function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function tryAutoLogin() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const me = await window.pos.me(token);
  if (me?.ok) {
    // keep user card info usable across pages
    saveAuth(token, me.data?.user);
    window.location.href = "../pos/pos.html";
  } else {
    clearAuth();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await tryAutoLogin();

  const form = document.getElementById("loginForm");
  if (!form) {
    console.error("loginForm not found. Check your HTML id.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username")?.value?.trim();
    const password = document.getElementById("password")?.value;

    if (!username || !password) {
      alert("Enter username and password");
      return;
    }

    const res = await window.pos.login({ username, password });
    if (!res?.ok) {
      alert(res?.message || "Invalid username or password");
      return;
    }

    const { token, user } = res.data;
    saveAuth(token, user);

    // You don't have a change-password UI yet; keep flow simple.
    // (Admin can reset passwords from Admin → Users.)
    window.location.href = "../pos/pos.html";
  });
});
