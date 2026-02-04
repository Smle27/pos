import { toast } from "../../shared/components/toast.js";

const token = localStorage.getItem("token");
try { window.pos?.setToken?.(token); } catch (_) {}

const el = {
  whoName: document.getElementById("whoName"),
  whoRole: document.getElementById("whoRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  statusBadge: document.getElementById("statusBadge"),
  globalSearch: document.getElementById("globalSearch"),

  tabs: [...document.querySelectorAll(".tab")],
  panels: {
    users: document.getElementById("tab-users"),
    products: document.getElementById("tab-products"),
    stock: document.getElementById("tab-stock"),
    moves: document.getElementById("tab-moves"),
    low: document.getElementById("tab-low"),
  },

  // users
  usersTable: document.querySelector("#usersTable tbody"),
  btnNewUser: document.getElementById("btnNewUser"),
  btnRefreshUsers: document.getElementById("btnRefreshUsers"),

  // products
  productsTable: document.querySelector("#productsTable tbody"),
  btnNewProduct: document.getElementById("btnNewProduct"),
  btnRefreshProducts: document.getElementById("btnRefreshProducts"),

  // stock
  btnReceiveStock: document.getElementById("btnReceiveStock"),
  btnAdjustStock: document.getElementById("btnAdjustStock"),
  stockSearch: document.getElementById("stockSearch"),
  stockSearchResults: document.getElementById("stockSearchResults"),

  // moves
  movesProductId: document.getElementById("movesProductId"),
  btnLoadMoves: document.getElementById("btnLoadMoves"),
  movesTable: document.querySelector("#movesTable tbody"),

  // low
  lowThreshold: document.getElementById("lowThreshold"),
  btnLoadLow: document.getElementById("btnLoadLow"),
  lowTable: document.querySelector("#lowTable tbody"),

  // modal
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalFooter: document.getElementById("modalFooter"),
  modalClose: document.getElementById("modalClose"),
};

let productsCache = [];
let usersCache = [];

boot();

async function boot() {
  if (!token) return (location.href = "../login/login.html");

  const me = await window.pos.me(token);
  if (!me.ok) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return (location.href = "../login/login.html");
  }

  el.whoName.textContent = me.data.user.username;
  el.whoRole.textContent = me.data.user.role;

  if (me.data.user.role !== "ADMIN") {
    toast("Admin only", "danger");
    return (location.href = "../pos/pos.html");
  }

  el.logoutBtn.onclick = async () => {
    await window.pos.logout(token);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "../login/login.html";
  };

  // Tabs
  el.tabs.forEach((t) => {
    t.onclick = () => showTab(t.dataset.tab);
  });

  // Modal
  el.modalClose.onclick = closeModal;
  el.modal.addEventListener("click", (e) => {
    if (e.target === el.modal) closeModal();
  });

  // Ctrl+K global search focus
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      el.globalSearch.focus();
      el.globalSearch.select();
    }
  });

  el.globalSearch.addEventListener("input", () => {
    const q = el.globalSearch.value.trim().toLowerCase();
    if (!q) return;

    // Quick switch to products tab if matches product search
    if (productsCache.some((p) => (p.name || "").toLowerCase().includes(q) || String(p.barcode || "").includes(q))) {
      showTab("products");
      renderProducts(filterProducts(q));
    } else if (usersCache.some((u) => (u.username || "").toLowerCase().includes(q))) {
      showTab("users");
      renderUsers(filterUsers(q));
    }
  });

  // Users
  el.btnNewUser.onclick = openNewUserModal;
  el.btnRefreshUsers.onclick = loadUsers;

  // Products
  el.btnNewProduct.onclick = openNewProductModal;
  el.btnRefreshProducts.onclick = loadProducts;

  // Stock quick search
  el.stockSearch.addEventListener("input", () => {
    const q = el.stockSearch.value.trim().toLowerCase();
    if (!q) return (el.stockSearchResults.innerHTML = "");
    const list = filterProducts(q).slice(0, 6);
    el.stockSearchResults.innerHTML = list
      .map(
        (p) => `
        <div class="card2" style="margin-bottom:10px;">
          <div style="font-weight:1000;">${esc(p.name)}</div>
          <div style="color:var(--muted); font-size:12px;">Barcode: ${esc(p.barcode || "-")} • Stock: ${p.stock ?? "-"}</div>
          <div style="margin-top:10px; display:flex; gap:10px;">
            <button class="btn success smallBtn" data-act="recv" data-id="${p.id}">Receive</button>
            <button class="btn warn smallBtn" data-act="adj" data-id="${p.id}">Adjust</button>
          </div>
        </div>
      `
      )
      .join("");

    el.stockSearchResults.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.id;
        const act = b.dataset.act;
        if (act === "recv") openReceiveStockModal(id);
        else openAdjustStockModal(id);
      };
    });
  });

  el.btnReceiveStock.onclick = () => openReceiveStockModal();
  el.btnAdjustStock.onclick = () => openAdjustStockModal();

  // Moves / Low
  el.btnLoadMoves.onclick = loadMoves;
  el.btnLoadLow.onclick = loadLow;

  // Initial load
  await Promise.all([loadProducts(), loadUsers()]);
  showTab("users");
  setStatus("Loaded");
}

/* ---------------- Tabs ---------------- */
function showTab(name) {
  el.tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  Object.entries(el.panels).forEach(([k, node]) => node.classList.toggle("show", k === name));
}

/* ---------------- Status ---------------- */
function setStatus(s) {
  el.statusBadge.textContent = s;
}

/* ---------------- Modal ---------------- */
function openModal(title, bodyHtml, footerHtml) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  el.modalFooter.innerHTML = footerHtml;
  el.modal.classList.add("show");
}
function closeModal() {
  el.modal.classList.remove("show");
}

/* ---------------- USERS ---------------- */
async function loadUsers() {
  setStatus("Loading users…");

  // Prefer payload-style (works with your current IPC)
  const r = await window.pos.listUsers?.({ limit: 500 });

  if (!r) {
    setStatus("Users IPC missing");
    toast("Users IPC not wired yet", "danger");
    return;
  }
  if (!r.ok) {
    setStatus("Users load failed");
    return toast(r.message || "Failed to load users", "danger");
  }

  usersCache = r.data || [];
  renderUsers(usersCache);
  setStatus(`Users loaded (${usersCache.length})`);
}


function filterUsers(q) {
  return usersCache.filter((u) => (u.username || "").toLowerCase().includes(q));
}

function renderUsers(list) {
  el.usersTable.innerHTML = "";
  if (!list.length) {
    el.usersTable.innerHTML = `<tr><td colspan="4" style="color:var(--muted);">No users</td></tr>`;
    return;
  }

  list.forEach((u) => {
    const tr = document.createElement("tr");

    const rolePill = u.role === "ADMIN" ? "admin" : "cashier";

    // ✅ correct field: is_active (0/1)
    const isActive = !(u.is_active === 0 || u.is_active === false);
    const statusPill = isActive ? "ok" : "off";

    tr.innerHTML = `
      <td style="font-weight:1000;">${esc(u.username)}</td>
      <td><span class="pill ${rolePill}">${esc(u.role)}</span></td>
      <td><span class="pill ${statusPill}">${isActive ? "ACTIVE" : "DISABLED"}</span></td>
      <td>
        <div class="rowActions">
          <button class="btn smallBtn" data-act="reset">Reset PW</button>
          <button class="btn warn smallBtn" data-act="toggle">${isActive ? "Disable" : "Enable"}</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-act="reset"]').onclick = () => openResetPwModal(u);
    tr.querySelector('[data-act="toggle"]').onclick = () => toggleUser(u, isActive);

    el.usersTable.appendChild(tr);
  });
}


function openNewUserModal() {
  openModal(
    "Create User",
    `
      <div class="grid2">
        <div>
          <label style="color:var(--muted); font-size:12px;">Username</label>
          <input class="input" id="nu_username" placeholder="e.g. cashier1">
        </div>
        <div>
          <label style="color:var(--muted); font-size:12px;">Role</label>
          <select id="nu_role">
            <option value="CASHIER">CASHIER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      </div>
      <div style="margin-top:12px;">
        <label style="color:var(--muted); font-size:12px;">Temporary Password</label>
        <input class="input" id="nu_password" placeholder="e.g. 1234">
      </div>
      <div class="hint" style="margin-top:10px;">User can be forced to change password at first login.</div>
    `,
    `
      <button class="btn" id="nu_cancel">Cancel</button>
      <button class="btn primary" id="nu_save">Create</button>
    `
  );

  document.getElementById("nu_cancel").onclick = closeModal;
  document.getElementById("nu_save").onclick = async () => {
    const username = document.getElementById("nu_username").value.trim();
    const role = document.getElementById("nu_role").value;
    const password = document.getElementById("nu_password").value.trim();

    if (!username || !password) return toast("Username & password required", "danger");

    const r = await window.pos.createUser({ username, role, password });
    if (!r.ok) return toast(r.message || "Create user failed", "danger");

    toast("User created", "success");
    closeModal();
    await loadUsers();
  };
}

function openResetPwModal(u) {
  openModal(
    `Reset Password: ${u.username}`,
    `
      <div>
        <label style="color:var(--muted); font-size:12px;">New Temporary Password</label>
        <input class="input" id="rpw_new" placeholder="e.g. 1234">
      </div>
      <div class="hint" style="margin-top:10px;">User will be asked to change password on next login.</div>
    `,
    `
      <button class="btn" id="rpw_cancel">Cancel</button>
      <button class="btn warn" id="rpw_save">Reset</button>
    `
  );

  document.getElementById("rpw_cancel").onclick = closeModal;
  document.getElementById("rpw_save").onclick = async () => {
    const newPassword = document.getElementById("rpw_new").value.trim();
    if (!newPassword) return toast("Password required", "danger");

    const r = await window.pos.resetUserPassword({ userId: u.id, newPassword });
    if (!r.ok) return toast(r.message || "Reset failed", "danger");

    toast("Password reset", "success");
    closeModal();
    await loadUsers();
  };
}

async function toggleUser(u, isActiveNow) {
  const r = await window.pos.setUserActive({ userId: u.id, active: !isActiveNow });
  if (!r.ok) return toast(r.message || "Update failed", "danger");
  toast("User updated", "success");
  await loadUsers();
}


/* ---------------- PRODUCTS ---------------- */
async function loadProducts() {
  setStatus("Loading products…");
  const r = await window.pos.listProducts(token, "", 500);
  if (!r.ok) {
    setStatus("Products load failed");
    return toast(r.message || "Failed to load products", "danger");
  }
  productsCache = r.data || [];
  renderProducts(productsCache);
  setStatus("Products loaded");
}

function filterProducts(q) {
  return productsCache.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const bc = String(p.barcode || "");
    return name.includes(q) || bc.includes(q);
  });
}

function renderProducts(list) {
  el.productsTable.innerHTML = "";
  if (!list.length) {
    el.productsTable.innerHTML = `<tr><td colspan="5" style="color:var(--muted);">No products</td></tr>`;
    return;
  }

  list.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:1000;">${esc(p.name)}</td>
      <td>${esc(p.barcode || "-")}</td>
      <td>${money(p.price)}</td>
      <td>${p.stock ?? "-"}</td>
      <td>
        <div class="rowActions">
          <button class="btn smallBtn" data-act="edit">Edit</button>
          <button class="btn danger smallBtn" data-act="del">Delete</button>
        </div>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = () => openEditProductModal(p);
    tr.querySelector('[data-act="del"]').onclick = () => deleteProduct(p);
    el.productsTable.appendChild(tr);
  });
}

function openNewProductModal() {
  openModal(
    "Create Product",
    productFormHtml(),
    `
      <button class="btn" id="p_cancel">Cancel</button>
      <button class="btn primary" id="p_save">Create</button>
    `
  );
  document.getElementById("p_cancel").onclick = closeModal;
  document.getElementById("p_save").onclick = async () => {
    const data = readProductForm();
    if (!data.name || !data.barcode || data.price <= 0) return toast("Name, barcode, price required", "danger");

    const r = await window.pos.createProduct(token, data);
    if (!r.ok) return toast(r.message || "Create failed", "danger");

    toast("Product created", "success");
    closeModal();
    await loadProducts();
  };
}
el.btnNewProduct.onclick = openNewProductModal;

function openEditProductModal(p) {
  openModal(
    `Edit Product`,
    productFormHtml(p),
    `
      <button class="btn" id="p_cancel">Cancel</button>
      <button class="btn warn" id="p_save">Save</button>
    `
  );

  document.getElementById("p_cancel").onclick = closeModal;
  document.getElementById("p_save").onclick = async () => {
    const patch = readProductForm();
    const r = await window.pos.updateProduct(token, p.id, patch);
    if (!r.ok) return toast(r.message || "Update failed", "danger");

    toast("Product updated", "success");
    closeModal();
    await loadProducts();
  };
}

async function deleteProduct(p) {
  const yes = confirm(`Delete "${p.name}"?`);
  if (!yes) return;

  const r = await window.pos.deleteProduct(token, p.id);
  if (!r.ok) return toast(r.message || "Delete failed", "danger");

  toast("Product deleted", "success");
  await loadProducts();
}

function productFormHtml(p = {}) {
  return `
    <div>
      <label style="color:var(--muted); font-size:12px;">Name</label>
      <input class="input" id="p_name" value="${escAttr(p.name || "")}" placeholder="e.g. Sugar 1kg">
    </div>

    <div class="grid2" style="margin-top:12px;">
      <div>
        <label style="color:var(--muted); font-size:12px;">Barcode</label>
        <input class="input" id="p_barcode" value="${escAttr(p.barcode || "")}" placeholder="Scan barcode">
      </div>
      <div>
        <label style="color:var(--muted); font-size:12px;">Price</label>
        <input class="input" id="p_price" value="${escAttr(p.price ?? "")}" placeholder="e.g. 5000">
      </div>
    </div>

    <div class="grid2" style="margin-top:12px;">
      <div>
        <label style="color:var(--muted); font-size:12px;">Cost (optional)</label>
        <input class="input" id="p_cost" value="${escAttr(p.cost ?? "")}" placeholder="e.g. 4200">
      </div>
      <div>
        <label style="color:var(--muted); font-size:12px;">Min Stock (optional)</label>
        <input class="input" id="p_min" value="${escAttr(p.minStock ?? "")}" placeholder="e.g. 5">
      </div>
    </div>
  `;
}

function readProductForm() {
  return {
    name: document.getElementById("p_name").value.trim(),
    barcode: document.getElementById("p_barcode").value.trim(),
    price: Number(document.getElementById("p_price").value || 0),
    cost: Number(document.getElementById("p_cost").value || 0) || null,
    minStock: Number(document.getElementById("p_min").value || 0) || 0,
  };
}

/* ---------------- STOCK MODALS ---------------- */
function openReceiveStockModal(productId = "") {
  openModal(
    "Receive Stock",
    `
      <div class="grid2">
        <div>
          <label style="color:var(--muted); font-size:12px;">Product ID</label>
          <input class="input" id="s_pid" value="${escAttr(productId)}" placeholder="Product ID">
        </div>
        <div>
          <label style="color:var(--muted); font-size:12px;">Quantity</label>
          <input class="input" id="s_qty" placeholder="e.g. 20">
        </div>
      </div>
      <div style="margin-top:12px;">
        <label style="color:var(--muted); font-size:12px;">Supplier / Note</label>
        <input class="input" id="s_note" placeholder="e.g. Delivered by ABC Supplies">
      </div>
    `,
    `
      <button class="btn" id="s_cancel">Cancel</button>
      <button class="btn success" id="s_save">Receive</button>
    `
  );
  document.getElementById("s_cancel").onclick = closeModal;
  document.getElementById("s_save").onclick = async () => {
    const productId = document.getElementById("s_pid").value.trim();
    const qty = Number(document.getElementById("s_qty").value || 0);
    const note = document.getElementById("s_note").value.trim();

    if (!productId || qty <= 0) return toast("Product ID and qty required", "danger");

    const r = await window.pos.applyStockMove(token, {
  productId: Number(productId),
  qtyChange: Number(qty),
  reason: "RECEIVE",
  note
});
    if (!r.ok) return toast(r.message || "Receive failed", "danger");

    toast("Stock received", "success");
    closeModal();
    await loadProducts();
  };
}

function openAdjustStockModal(productId = "") {
  openModal(
    "Adjust Stock",
    `
      <div class="grid2">
        <div>
          <label style="color:var(--muted); font-size:12px;">Product ID</label>
          <input class="input" id="a_pid" value="${escAttr(productId)}" placeholder="Product ID">
        </div>
        <div>
          <label style="color:var(--muted); font-size:12px;">Qty Delta (+/-)</label>
          <input class="input" id="a_delta" placeholder="e.g. -2 or 5">
        </div>
      </div>
      <div style="margin-top:12px;">
        <label style="color:var(--muted); font-size:12px;">Reason</label>
        <input class="input" id="a_reason" placeholder="e.g. damaged, correction, loss">
      </div>
    `,
    `
      <button class="btn" id="a_cancel">Cancel</button>
      <button class="btn warn" id="a_save">Apply</button>
    `
  );
  document.getElementById("a_cancel").onclick = closeModal;
  document.getElementById("a_save").onclick = async () => {
    const productId = document.getElementById("a_pid").value.trim();
    const qtyDelta = Number(document.getElementById("a_delta").value || 0);
    const reason = document.getElementById("a_reason").value.trim();

    if (!productId || qtyDelta === 0) return toast("Product ID and delta required", "danger");

    const r = await window.pos.applyStockMove(token, {
  productId: Number(productId),
  qtyChange: Number(qtyDelta),
  reason: reason || "ADJUST",
  note: reason
});
    if (!r.ok) return toast(r.message || "Adjust failed", "danger");

    toast("Stock adjusted", "success");
    closeModal();
    await loadProducts();
  };
}

/* ---------------- MOVES / LOW ---------------- */
async function loadMoves() {
  setStatus("Loading movements…");
  const productId = el.movesProductId.value.trim() || null;

  const r = await window.pos.stockMoves(token, {
  productId: productId ? Number(productId) : undefined,
  limit: 200
});
  if (!r.ok) {
    setStatus("Moves failed");
    return toast(r.message || "Failed to load movements", "danger");
  }

  el.movesTable.innerHTML = "";
  (r.data || []).forEach((m) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(m.time || m.createdAt || "")}</td>
      <td>${esc(String(m.productId ?? ""))}</td>
      <td style="font-weight:1000;">${esc(String(m.qtyDelta ?? m.delta ?? ""))}</td>
      <td>${esc(m.type || "")}</td>
      <td>${esc(m.note || "")}</td>
    `;
    el.movesTable.appendChild(tr);
  });

  setStatus("Movements loaded");
}

async function loadLow() {
  setStatus("Loading low stock…");
  const threshold = el.lowThreshold.value.trim();
  const r = await window.pos.lowStock(token, threshold ? Number(threshold) : null);

  if (!r.ok) {
    setStatus("Low stock failed");
    return toast(r.message || "Failed to load low stock", "danger");
  }

  el.lowTable.innerHTML = "";
  (r.data || []).forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:1000;">${esc(p.name || "")}</td>
      <td>${esc(p.barcode || "-")}</td>
      <td>${esc(String(p.stock ?? "-"))}</td>
      <td>${esc(String(p.minStock ?? p.min ?? "-"))}</td>
    `;
    el.lowTable.appendChild(tr);
  });

  setStatus("Low stock loaded");
}

/* ---------------- Helpers ---------------- */
function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}
function escAttr(s) {
  return esc(String(s)).replace(/"/g, "&quot;");
}
