import { toast } from "../../shared/components/toast.js";

const token = localStorage.getItem("token");

const els = {
  whoName: document.getElementById("whoName"),
  whoRole: document.getElementById("whoRole"),
  logoutBtn: document.getElementById("logoutBtn"),

  barcodeInput: document.getElementById("barcodeInput"),
  searchBtn: document.getElementById("searchBtn"),
  productList: document.getElementById("productList"),

  cartList: document.getElementById("cartList"),
  cartCount: document.getElementById("cartCount"),
  cartTotal: document.getElementById("cartTotal"),
  subTotal: document.getElementById("subTotal"),
  discountInput: document.getElementById("discountInput"),
  grandTotal: document.getElementById("grandTotal"),

  holdBtn: document.getElementById("holdBtn"),
  clearBtn: document.getElementById("clearBtn"),
  payBtn: document.getElementById("payBtn"),

  payModal: document.getElementById("payModal"),
  closePay: document.getElementById("closePay"),
  cancelPay: document.getElementById("cancelPay"),
  confirmPay: document.getElementById("confirmPay"),
  payTotal: document.getElementById("payTotal"),
  payMethod: document.getElementById("payMethod"),
  payAmount: document.getElementById("payAmount"),
  paidView: document.getElementById("paidView"),
  changeView: document.getElementById("changeView"),
};

let products = [];
let cart = []; // [{id,name,price,barcode,qty}]
let discount = 0;

boot();

async function boot(){
  if(!token){
    location.href = "../login/login.html";
    return;
  }

  const me = await window.pos.me(token);
  if(!me.ok){
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "../login/login.html";
    return;
  }

  els.whoName.textContent = me.data.user.username;
  els.whoRole.textContent = me.data.user.role;

  await loadProducts("");

  els.searchBtn.onclick = () => loadProducts(els.barcodeInput.value.trim());
  els.barcodeInput.addEventListener("keydown", async (e)=>{
    if(e.key === "Enter"){
      const v = els.barcodeInput.value.trim();
      if(!v) return;

      // Try barcode lookup first
      const r = await window.pos.getProductByBarcode(token, v);
      if(r.ok){
        addToCart(r.data);
        els.barcodeInput.value = "";
        return;
      }

      // otherwise search list
      await loadProducts(v);
    }
    if(e.key === "F6"){ els.barcodeInput.select(); }
  });

  els.discountInput.addEventListener("input", ()=>{
    discount = Number(els.discountInput.value || 0);
    renderCart();
  });

  els.clearBtn.onclick = ()=>{
    cart = [];
    discount = 0;
    els.discountInput.value = "";
    renderCart();
    toast("Cart cleared", "info");
  };

  els.holdBtn.onclick = holdSale;
  els.payBtn.onclick = openPay;

  els.closePay.onclick = closePay;
  els.cancelPay.onclick = closePay;

  // keypad buttons
  document.querySelectorAll("[data-k]").forEach(btn=>{
    btn.addEventListener("click", ()=> keypad(btn.dataset.k));
  });

  els.payAmount.addEventListener("input", updatePayPreview);
  els.confirmPay.onclick = confirmPay;

  els.logoutBtn.onclick = async ()=>{
    await window.pos.logout(token);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    location.href = "../login/login.html";
  };

  // Shortcuts
  window.addEventListener("keydown", (e)=>{
    if(e.key === "F2"){ e.preventDefault(); openPay(); }
    if(e.key === "F4"){ e.preventDefault(); holdSale(); }
    if(e.key === "F6"){ e.preventDefault(); els.barcodeInput.focus(); els.barcodeInput.select(); }
  });

  renderCart();
}

async function loadProducts(q){
  const r = await window.pos.listProducts(token, q, 200);
  if(!r.ok){
    toast(r.message || "Failed to load products", "danger");
    return;
  }
  products = r.data || [];
  renderProducts();
}

function renderProducts(){
  els.productList.innerHTML = "";
  if(products.length === 0){
    els.productList.innerHTML = `<div class="badge">No products found</div>`;
    return;
  }

  products.forEach(p=>{
    const row = document.createElement("div");
    row.className = "productRow";
    row.innerHTML = `
      <div class="productMeta">
        <div class="productName">${escapeHtml(p.name)}</div>
        <div class="productSub">Barcode: ${escapeHtml(p.barcode || "-")} • Stock: ${p.stock ?? "-"}</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <div style="font-weight:900;">${money(p.price)}</div>
        <button class="btn primary">Add</button>
      </div>
    `;
    row.querySelector("button").onclick = ()=> addToCart(p);
    els.productList.appendChild(row);
  });
}

function addToCart(p){
  const id = p.id ?? p.productId ?? p.barcode;
  let item = cart.find(x => x.id === id);
  if(!item){
    item = {
      id,
      name: p.name,
      barcode: p.barcode || "",
      price: Number(p.price || 0),
      qty: 1,
    };
    cart.unshift(item);
  } else {
    item.qty += 1;
  }
  renderCart();
}

function renderCart(){
  els.cartList.innerHTML = "";
  const subtotal = cart.reduce((sum, it)=> sum + it.price * it.qty, 0);
  const grand = Math.max(0, subtotal - (Number(discount)||0));

  els.cartCount.textContent = String(cart.reduce((sum,it)=> sum + it.qty, 0));
  els.cartTotal.textContent = money(grand);
  els.subTotal.textContent = money(subtotal);
  els.grandTotal.textContent = money(grand);

  if(cart.length === 0){
    els.cartList.innerHTML = `<div class="badge">Cart is empty</div>`;
    return;
  }

  cart.forEach(it=>{
    const row = document.createElement("div");
    row.className = "cartRow";
    row.innerHTML = `
      <div class="productMeta">
        <div class="productName">${escapeHtml(it.name)}</div>
        <div class="productSub">${escapeHtml(it.barcode || "")} • ${money(it.price)} each</div>
      </div>

      <div class="qtyBox">
        <button class="qtyBtn">-</button>
        <div class="qtyVal">${it.qty}</div>
        <button class="qtyBtn">+</button>
      </div>
    `;
    const [minus, plus] = row.querySelectorAll(".qtyBtn");
    minus.onclick = ()=>{
      it.qty -= 1;
      if(it.qty <= 0) cart = cart.filter(x => x !== it);
      renderCart();
    };
    plus.onclick = ()=>{
      it.qty += 1;
      renderCart();
    };
    els.cartList.appendChild(row);
  });
}

async function holdSale(){
  if(cart.length === 0) return toast("Cart is empty", "danger");
  const r = await window.pos.holdSale(token, cart.map(x=>({
    productId: x.id,
    qty: x.qty
  })), { note: "Held from POS" });

  if(!r.ok) return toast(r.message || "Failed to hold sale", "danger");

  cart = [];
  discount = 0;
  els.discountInput.value = "";
  renderCart();
  toast("Sale held", "success");
}

function openPay(){
  if(cart.length === 0) return toast("Cart is empty", "danger");
  const subtotal = cart.reduce((sum, it)=> sum + it.price * it.qty, 0);
  const grand = Math.max(0, subtotal - (Number(discount)||0));
  els.payTotal.textContent = money(grand);
  els.payAmount.value = "";
  els.paidView.textContent = money(0);
  els.changeView.textContent = money(0);
  els.payModal.classList.add("show");
  els.payAmount.focus();
}

function closePay(){
  els.payModal.classList.remove("show");
}

function keypad(k){
  if(k === "C"){ els.payAmount.value = ""; updatePayPreview(); return; }
  els.payAmount.value = (els.payAmount.value || "") + k;
  updatePayPreview();
}

function updatePayPreview(){
  const grand = readGrandTotal();
  const paid = Number(els.payAmount.value || 0);
  els.paidView.textContent = money(paid);
  els.changeView.textContent = money(Math.max(0, paid - grand));
}

async function confirmPay(){
  const grand = readGrandTotal();
  const paid = Number(els.payAmount.value || 0);

  if(paid <= 0) return toast("Enter amount received", "danger");
  if(paid < grand && els.payMethod.value === "CASH") {
    return toast("Cash paid is less than total", "danger");
  }

  const payload = {
    cartItems: cart.map(x=>({ productId: x.id, qty: x.qty })),
    payments: [{ method: els.payMethod.value, amount: paid }],
    note: "POS checkout",
  };

  const me = await window.pos.me(token);
  if(!me.ok) return toast("Session expired, login again", "danger");

  const r = await window.pos.checkout(token, payload);
  if(!r.ok) return toast(r.message || "Checkout failed", "danger");

  // ✅ PRINT RECEIPT (before clearing cart)
  await tryPrintReceipt({
    me,
    saleResp: r.data,
    grand,
    paid,
  });

  closePay();

  // ✅ Clear AFTER print attempt
  cart = [];
  discount = 0;
  els.discountInput.value = "";
  renderCart();

  toast("Sale completed", "success");
}


function readGrandTotal(){
  const subtotal = cart.reduce((sum, it)=> sum + it.price * it.qty, 0);
  return Math.max(0, subtotal - (Number(discount)||0));
}

function money(n){
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

async function tryPrintReceipt({ me, saleResp, grand, paid }) {
  try {
    // Ensure printing API exists
    if (!window.pos || typeof window.pos.printSale !== "function") {
      toast("Printing not available (preload printSale missing)", "danger");
      return;
    }

    // Load printer config (saved from Settings)
    const cfg = (typeof window.pos.getPrinterConfig === "function")
      ? await window.pos.getPrinterConfig()
      : null;

    if (!cfg?.printerName) {
      toast("Printer not configured (Settings → Printer)", "info");
      return;
    }

    // Determine receipt/invoice number from backend response
    const receiptNo =
      saleResp?.receiptNo ??
      saleResp?.receipt ??
      saleResp?.receiptNumber ??
      saleResp?.invoiceNo ??
      saleResp?.saleId ??
      saleResp?.id ??
      `SALE-${Date.now()}`;

    // Build numbers
    const subtotalNum = cart.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);
    const discountNum = Number(discount || 0);
    const grandNum = Math.max(0, subtotalNum - discountNum);

    // Use the computed grand as source of truth (or the passed-in grand)
    const finalGrand = Number.isFinite(grand) ? Number(grand) : grandNum;

    // Items for both templates (A4 needs barcode + price)
    const items = cart.map(i => ({
      name: i.name,
      barcode: i.barcode || "",
      qty: i.qty,
      price: money(i.price),
      total: money(Number(i.price || 0) * Number(i.qty || 0)),
    }));

    // Payment info
    const method = els.payMethod?.value || "CASH";

    // Build unified payload (print engine decides thermal/A4 by cfg.paperSize)
    const payload = {
      // Shop details (later load from Settings store)
      logoText: "OP",
      shopName: "OLIVES POS",
      shopAddress: "Kampala, Uganda",
      shopPhone: "0700000000",

      // both keys provided, so either template can use it
      receiptNo: String(receiptNo),
      invoiceNo: String(receiptNo),

      date: new Date().toLocaleString(),
      cashier: me?.data?.user?.username || "CASHIER",

      // Customer placeholders (later take from Pay modal)
      customer: {
        name: "Walk-in Customer",
        phone: "-",
      },

      items,

      subtotal: money(subtotalNum),
      discount: money(discountNum),
      total: money(finalGrand),

      paid: money(paid),
      change: money(Math.max(0, Number(paid || 0) - finalGrand)),

      payments: [{ method, amount: Number(paid || 0) }],
      footer: cfg.footer || "Thank you for shopping with us",
    };

    const pr = await window.pos.printSale(payload);

    if (!pr?.ok) {
      toast(pr?.message || "Printing failed (check printer settings)", "danger");
      return;
    }

    toast(cfg.paperSize === "A4" ? "Invoice printed (A4)" : "Receipt printed", "success");
  } catch (err) {
    toast("Print error: " + (err?.message || err), "danger");
  }
}
  try {
    // If you saved printer config in settings
    const cfg = await window.pos.getPrinterConfig?.();
    if (!cfg?.printerName) {
      toast("Printer not configured (Settings → Printer)", "info");
      return;
    }

    const receiptNo =
      saleResp?.receiptNo ||
      saleResp?.receipt ||
      saleResp?.receiptNumber ||
      saleResp?.saleId ||
      "SALE";

    const items = cart.map(i => ({
      name: i.name,
      qty: i.qty,
      total: money(i.price * i.qty),
    }));

    const payload = {
      shopName: "OLIVES POS",          // later load from settings
      shopPhone: "0700000000",         // later load from settings
      receiptNo: String(receiptNo),
      date: new Date().toLocaleString(),
      cashier: me.data.user.username,
      items,
      total: money(grand),
      paid: money(paid),
      change: money(Math.max(0, paid - grand)),
    };

    const pr = await window.pos.printSale(payload);
    if (!pr?.ok) {
      toast("Printing failed (check printer settings)", "danger");
      return;
    }

    toast("Receipt printed", "success");
  } catch (err) {
    toast("Print error: " + (err?.message || err), "danger");
  }

