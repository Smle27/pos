import { toast } from "../../shared/components/toast.js";

const token = localStorage.getItem("token");

const printerName = document.getElementById("printerName");
const paperSize = document.getElementById("paperSize");
const receiptFooter = document.getElementById("receiptFooter");
const savePrinter = document.getElementById("savePrinter");
const testPrint = document.getElementById("testPrint");

bootPrinter();

async function bootPrinter(){
  const printers = await window.pos.getPrinters();
  printers.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    printerName.appendChild(opt);
  });

  const cfg = await window.pos.getPrinterConfig();
  if(cfg){
    printerName.value = cfg.printerName || "";
    paperSize.value = cfg.paperSize || "58";
    receiptFooter.value = cfg.footer || "";
  }
}

savePrinter.onclick = async ()=>{
  const cfg = {
    printerName: printerName.value,
    paperSize: paperSize.value,
    footer: receiptFooter.value,
  };
  const r = await window.pos.savePrinterConfig(cfg);
  if(!r.ok) return toast("Save failed", "danger");
  toast("Printer settings saved", "success");
};

testPrint.onclick = async ()=>{
  const r = await window.pos.testPrint();
  if(!r.ok) return toast("Test print failed", "danger");
  toast("Test receipt sent to printer", "success");
};
