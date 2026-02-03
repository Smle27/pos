const { contextBridge, ipcRenderer } = require("electron");

// Keep token inside preload (safer + avoids UI forgetting it)
let AUTH_TOKEN = null;

function setToken(token) {
  AUTH_TOKEN = token || null;
}

function getToken() {
  return AUTH_TOKEN;
}

// Always attach token automatically.
// Also supports old calls where you pass token explicitly.
function invoke(channel, payload = {}, tokenOverride = null) {
  const token = tokenOverride ?? AUTH_TOKEN ?? null;
  return ipcRenderer.invoke(channel, { token, ...(payload || {}) });
}

contextBridge.exposeInMainWorld("pos", {
  // Token helpers (recommended)
  setToken,
  getToken,

  // AUTH
  login: (data) => ipcRenderer.invoke("auth:login", data),
  logout: (token) => invoke("auth:logout", {}, token),
  me: (token) => invoke("auth:me", {}, token),

  // DEBUG (temporary)
  debugUsers: () => ipcRenderer.invoke("auth:debugUsers", {}),

  // SALES (backward compatible)
  holdSale: (token, cartItems, meta = {}) =>
    invoke("sales:hold", { cartItems, ...meta }, token),

  listHeldSales: (token) =>
    invoke("sales:listHeld", {}, token),

  resumeSale: (token, saleId) =>
    invoke("sales:resume", { saleId }, token),

  checkout: (token, payload) =>
    invoke("sales:checkout", { ...(payload || {}) }, token),

  voidHeldSale: (token, saleId, reason) =>
    invoke("sales:voidHeld", { saleId, reason }, token),

  // PRODUCTS
  listProducts: (token, q = "", limit = 200) =>
    invoke("products:list", { q, limit }, token),

  getProductByBarcode: (token, barcode) =>
    invoke("products:byBarcode", { barcode }, token),

  createProduct: (token, product) =>
    invoke("products:create", { ...(product || {}) }, token),

  updateProduct: (token, id, patch) =>
    invoke("products:update", { id, patch }, token),

  deleteProduct: (token, id) =>
    invoke("products:delete", { id }, token),

  // STOCK
  getStock: (token, productId) =>
    invoke("stock:get", { productId }, token),

  lowStock: (token, threshold = 5, limit = 200, offset = 0) =>
    invoke("stock:low", { threshold, limit, offset }, token),

  stockMoves: (token, payload = {}) =>
    invoke("stock:moves", { ...(payload || {}) }, token),

  applyStockMove: (token, payload) =>
    invoke("stock:move", { ...(payload || {}) }, token),

  setStock: (token, payload) =>
    invoke("stock:set", { ...(payload || {}) }, token),

  // USERS
  listUsers: (token) => invoke("users:list", {}, token),
  createUser: (token, payload) => invoke("users:create", { ...(payload || {}) }, token),
  resetUserPassword: (token, payload) => invoke("users:resetPassword", { ...(payload || {}) }, token),
  setUserActive: (token, payload) => invoke("users:setActive", { ...(payload || {}) }, token),

  // REPORTS
  reportsSummary: (token, payload) => invoke("reports:summary", { ...(payload || {}) }, token),
  reportsSales: (token, payload) => invoke("reports:sales", { ...(payload || {}) }, token),
  reportsTopProducts: (token, payload) => invoke("reports:topProducts", { ...(payload || {}) }, token),
  reportsExportSalesCSV: (token, payload) => invoke("reports:exportSalesCSV", { ...(payload || {}) }, token),
  reportsExportTopCSV: (token, payload) => invoke("reports:exportTopCSV", { ...(payload || {}) }, token),

  // PRINTER (no token needed)
  getPrinters: () => ipcRenderer.invoke("printer:list"),
  getPrinterConfig: () => ipcRenderer.invoke("printer:getConfig"),
  savePrinterConfig: (cfg) => ipcRenderer.invoke("printer:saveConfig", cfg),
  testPrint: () => ipcRenderer.invoke("printer:test"),
  printSale: (payload) => ipcRenderer.invoke("printer:printSale", payload),

  // SHIFTS
  myOpenShift: (token) => invoke("shifts:myOpen", {}, token),
  openShift: (token, payload) => invoke("shifts:open", { ...(payload || {}) }, token),
  closeShift: (token, payload) => invoke("shifts:close", { ...(payload || {}) }, token),
  listShifts: (token, payload) => invoke("shifts:list", { ...(payload || {}) }, token),
});
