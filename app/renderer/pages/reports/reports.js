import { toast } from "../../shared/components/toast.js";

const token = localStorage.getItem("token");
try { window.pos?.setToken?.(token); } catch (_) {}

const el = {
  whoName: document.getElementById("whoName"),
  whoRole: document.getElementById("whoRole"),
  logoutBtn: document.getElementById("logoutBtn"),
  statusBadge: document.getElementById("statusBadge"),

  fromDate: document.getElementById("fromDate"),
  toDate: document.getElementById("toDate"),
  cashier: document.getElementById("cashier"),
  btnLoad: document.getElementById("btnLoad"),
  btnToday: document.getElementById("btnToday"),
  btnThisWeek: document.getElementById("btnThisWeek"),
  btnExportSales: document.getElementById("btnExportSales"),
  btnExportTop: document.getElementById("btnExportTop"),

  kGross: document.getElementById("kGross"),
  kTx: document.getElementById("kTx"),
  kAvg: document.getElementById("kAvg"),
  kCashier: document.getElementById("kCashier"),

  kGrossSub: document.getElementById("kGrossSub"),
  kTxSub: document.getElementById("kTxSub"),
  kAvgSub: document.getElementById("kAvgSub"),

  salesTableBody: document.querySelector("#salesTable tbody"),
  topTableBody: document.querySelector("#topTable tbody"),
};

boot();

/* ---------------- Helpers ---------------- */
function yyyy_mm_dd(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function setStatus(txt) {
  if (el.statusBadge) el.statusBadge.textContent = txt || "Ready";
}

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString() : String(v || 0);
}

function clearTable(tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";
}

function row(...cells) {
  const tr = document.createElement("tr");
  cells.forEach((c) => {
    const td = document.createElement("td");
    td.textContent = c ?? "";
    tr.appendChild(td);
  });
  return tr;
}

function startOfWeek(d) {
  // Monday start
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

/* ---------------- Boot ---------------- */
async function boot() {
  if (!token) {
    location.href = "../login/login.html";
    return;
  }

  const me = await window.pos.me(token);
  if (!me?.ok) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "../login/login.html";
    return;
  }

  el.whoName.textContent = me.data.user.username;
  el.whoRole.textContent = me.data.user.role;

  if (me.data.user.role !== "ADMIN") {
    toast("Reports are Admin-only", "danger");
    setTimeout(() => (location.href = "../pos/pos.html"), 700);
    return;
  }

  // Defaults: today
  const today = new Date();
  el.fromDate.value = yyyy_mm_dd(today);
  el.toDate.value = yyyy_mm_dd(today);

  el.btnLoad.onclick = loadAll;

  el.btnToday.onclick = () => {
    const t = new Date();
    el.fromDate.value = yyyy_mm_dd(t);
    el.toDate.value = yyyy_mm_dd(t);
    loadAll();
  };

  el.btnThisWeek.onclick = () => {
    const t = new Date();
    const s = startOfWeek(t);
    el.fromDate.value = yyyy_mm_dd(s);
    el.toDate.value = yyyy_mm_dd(t);
    loadAll();
  };

  el.btnExportSales.onclick = exportSales;
  el.btnExportTop.onclick = exportTop;

  el.logoutBtn.onclick = async () => {
    await window.pos.logout(token);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "../login/login.html";
  };

  await loadAll();
}

/* ---------------- Filters ---------------- */
function getFilters() {
  const from = el.fromDate?.value || null;
  const to = el.toDate?.value || null;

  // Only numeric userId supported for now
  const cashierRaw = (el.cashier?.value || "").trim();
  const userId = cashierRaw && /^[0-9]+$/.test(cashierRaw) ? Number(cashierRaw) : null;

  return { from, to, userId, cashierRaw };
}

/* ---------------- Load Reports ---------------- */
async function loadAll() {
  const { from, to, userId, cashierRaw } = getFilters();

  setStatus("Loading…");
  clearTable(el.salesTableBody);
  clearTable(el.topTableBody);

  const [sum, sales, top] = await Promise.all([
    window.pos.reportsSummary(token, { from, to, userId }),
    window.pos.reportsSales(token, { from, to, userId, limit: 200 }),
    window.pos.reportsTopProducts(token, { from, to, userId, limit: 30 }),
  ]);

  if (!sum?.ok) {
    setStatus("Error");
    return toast(sum?.message || "Failed to load summary", "danger");
  }
  if (!sales?.ok) {
    setStatus("Error");
    return toast(sales?.message || "Failed to load sales", "danger");
  }
  if (!top?.ok) {
    setStatus("Error");
    return toast(top?.message || "Failed to load top products", "danger");
  }
const gross = Number(sum.data?.grossSales || 0);
const tx = Number(sum.data?.transactions || 0);
const avg = tx > 0 ? (gross / tx) : 0;

el.kGross.textContent = money(gross);
el.kTx.textContent = money(tx);
el.kAvg.textContent = money(avg.toFixed(0)); // avg basket rounded to whole UGX

  el.kGrossSub.textContent = from && to ? `${from} → ${to}` : "All time";
  el.kTxSub.textContent = "Paid sales only";
  el.kAvgSub.textContent = "Gross / Tx";

  // ✅ Sales rows (repo returns: id, created_at, username, total, payment_method)
  (sales.data || []).forEach((s) => {
    el.salesTableBody.appendChild(
      row(
        s.id,
        s.created_at || "",
        s.username || (s.user_id ? `User ${s.user_id}` : ""),
        money(s.total),
        s.payment_method || ""
      )
    );
  });

  // ✅ Top rows (repo returns: name, qtySold, revenue)
  (top.data || []).forEach((p) => {
    el.topTableBody.appendChild(
      row(
        p.name || "",
        money(p.qtySold || 0),
        money(p.revenue || 0)
      )
    );
  });

  setStatus("Ready");
}

/* ---------------- Exports ---------------- */
async function exportSales() {
  const { from, to, userId } = getFilters();
  const r = await window.pos.reportsExportSalesCSV(token, { from, to, userId });
  if (!r?.ok) return toast(r?.message || "Export failed", "danger");
  toast("Sales CSV exported", "success");
}

async function exportTop() {
  const { from, to, userId } = getFilters();
  const r = await window.pos.reportsExportTopCSV(token, { from, to, userId });
  if (!r?.ok) return toast(r?.message || "Export failed", "danger");
  toast("Top products CSV exported", "success");
}
