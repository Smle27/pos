// app/renderer/shared/components/toast.js
export function toast(msg, type="info", ms=2200){
  let root = document.getElementById("toastRoot");
  if(!root){
    root = document.createElement("div");
    root.id = "toastRoot";
    root.style.position = "fixed";
    root.style.right = "16px";
    root.style.bottom = "16px";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "10px";
    root.style.zIndex = "9999";
    document.body.appendChild(root);
  }

  const el = document.createElement("div");
  el.className = "card";
  el.style.padding = "12px 14px";
  el.style.borderRadius = "14px";
  el.style.minWidth = "260px";
  el.style.maxWidth = "380px";
  el.style.borderColor = type==="danger" ? "rgba(239,68,68,.35)" :
                        type==="success" ? "rgba(34,197,94,.35)" :
                        "rgba(255,255,255,.10)";

  el.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
      <div style="font-weight:800">${escapeHtml(msg)}</div>
      <button class="btn" style="padding:6px 10px; border-radius:10px;">✕</button>
    </div>
  `;

  el.querySelector("button").onclick = () => el.remove();
  root.appendChild(el);
  setTimeout(()=> el.remove(), ms);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}
