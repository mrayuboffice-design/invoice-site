let logoDataUrl = "";
const STORAGE_KEY = "invoice_site_v2";

// ---------- DOM ----------
const itemsBody = document.getElementById("itemsBody");
const addRowBtn = document.getElementById("addRowBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const saveBtn = document.getElementById("saveBtn");
const printBtn = document.getElementById("printBtn");
const clearBtn = document.getElementById("clearBtn");
const logoInput = document.getElementById("logoInput");

const itemsSubtotalEl = document.getElementById("itemsSubtotal");
const taxableBaseEl = document.getElementById("taxableBase");
const gstTotalEl = document.getElementById("gstTotal");
const extraTaxViewEl = document.getElementById("extraTaxView");
const grandTotalEl = document.getElementById("grandTotal");

const discountEl = document.getElementById("discount");
const extraTaxEl = document.getElementById("extraTax");
const gstTypeEl = document.getElementById("gstType");
const igstRateEl = document.getElementById("igstRate");
const cgstRateEl = document.getElementById("cgstRate");
const sgstRateEl = document.getElementById("sgstRate");

const packingChargesEl = document.getElementById("packingCharges");
const freightChargesEl = document.getElementById("freightCharges");
const insuranceChargesEl = document.getElementById("insuranceCharges");
const otherChargesEl = document.getElementById("otherCharges");
const exportChargesTotalEl = document.getElementById("exportChargesTotal");

const shipSameAsCustomerEl = document.getElementById("shipSameAsCustomer");

// ---------- Helpers ----------
function toNum(v){ const n=parseFloat(v); return Number.isFinite(n)?n:0; }
function money(n){ return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2); }
function getField(id){ return (document.getElementById(id)?.value ?? "").trim(); }
function setField(id, v){ const el=document.getElementById(id); if(el) el.value = v ?? ""; }
function safeText(v, fb="-"){ const s=(v??"").toString().trim(); return s ? s : fb; }
function cmToPt(cm){ return cm * 28.3464567; }

function drawBox(doc,x,y,w,h){
  doc.setDrawColor(210);
  doc.setLineWidth(0.8);
  doc.roundedRect(x,y,w,h,8,8);
}

// ---------- Amount in Words (Indian) ----------
function numberToWordsIndian(n){
  n=Math.floor(n);
  if(!Number.isFinite(n)||n<0) return "";
  const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function twoDigits(num){
    if(num<20) return a[num];
    const tens=Math.floor(num/10);
    const ones=num%10;
    return b[tens]+(ones?" "+a[ones]:"");
  }
  function threeDigits(num){
    const h=Math.floor(num/100);
    const rest=num%100;
    let s="";
    if(h) s+=a[h]+" Hundred";
    if(rest) s+=(s?" ":"")+twoDigits(rest);
    return s;
  }
  if(n===0) return "Zero";
  const crore=Math.floor(n/10000000); n%=10000000;
  const lakh=Math.floor(n/100000); n%=100000;
  const thousand=Math.floor(n/1000); n%=1000;
  const hundredPart=n;
  const parts=[];
  if(crore) parts.push(threeDigits(crore)+" Crore");
  if(lakh) parts.push(threeDigits(lakh)+" Lakh");
  if(thousand) parts.push(threeDigits(thousand)+" Thousand");
  if(hundredPart) parts.push(threeDigits(hundredPart));
  return parts.join(" ").replace(/\s+/g," ").trim();
}

function amountInWords(total,currencyCode){
  const whole=Math.floor(total);
  const frac=Math.round((total-whole)*100);

  let major="Dollars", minor="Cents";
  const c=(currencyCode||"").toUpperCase();
  if(c==="INR"){ major="Rupees"; minor="Paise"; }
  if(c==="AED"){ major="Dirhams"; minor="Fils"; }
  if(c==="EUR"){ major="Euros"; minor="Cents"; }
  if(c==="GBP"){ major="Pounds"; minor="Pence"; }
  if(c==="SAR"){ major="Riyals"; minor="Halalas"; }

  const wholeWords = numberToWordsIndian(whole)+" "+major;
  const fracWords = frac ? (" and "+numberToWordsIndian(frac)+" "+minor) : "";
  return (wholeWords+fracWords+" Only").replace(/\s+/g," ").trim();
}

// ---------- Ship To sync ----------
function syncShipToFromCustomer(){
  if(!shipSameAsCustomerEl) return;
  const same = shipSameAsCustomerEl.checked;

  const shipFields = ["shipName","shipAddress","shipCountry","shipContact"];
  shipFields.forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.disabled = same;
  });

  if(same){
    setField("shipName", getField("buyerName"));
    setField("shipAddress", getField("buyerAddress"));
    setField("shipCountry", getField("buyerCountry"));
    setField("shipContact", getField("buyerContact"));
  }
}

// ---------- Storage ----------
function collectFormState(){
  const ids = [
    "docType","invoiceNo","invoiceDate","currency","paymentTerms","incoterms","termsBasis","placeOfSupply",
    "gstType","igstRate","cgstRate","sgstRate","extraTax",
    "sellerName","sellerAddress","sellerTax","sellerPan","sellerIec","sellerContact","sellerAdCode",
    "buyerName","buyerAddress","buyerCountry","buyerTax","buyerContact",
    "shipName","shipAddress","shipCountry","shipContact","shipSameAsCustomer",
    "portLoading","portDischarge","finalDestination","countryOrigin","shipmentMode","defaultHs","validity",
    "packingCharges","freightCharges","insuranceCharges","otherCharges","discount",
    "bankDetails","notes"
  ];

  const data = {};
  ids.forEach(id=>{
    if(id==="shipSameAsCustomer"){
      data[id] = !!document.getElementById("shipSameAsCustomer")?.checked;
    } else {
      data[id] = getField(id);
    }
  });

  data.items = [...itemsBody.querySelectorAll("tr")].map(tr=>({
    desc: tr.querySelector(".desc").value,
    hsn: tr.querySelector(".hsn").value,
    qty: tr.querySelector(".qty").value,
    unit: tr.querySelector(".unit").value,
    rate: tr.querySelector(".rate").value
  }));

  data.logoDataUrl = logoDataUrl || "";
  return data;
}

function saveToStorage(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState())); }catch(e){}
}

function loadFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);

    Object.keys(data).forEach(k=>{
      if(k==="items"||k==="logoDataUrl") return;
      if(k==="shipSameAsCustomer"){
        const el=document.getElementById("shipSameAsCustomer");
        if(el) el.checked = !!data[k];
        return;
      }
      setField(k, data[k]);
    });

    logoDataUrl = data.logoDataUrl || "";

    itemsBody.innerHTML="";
    if(Array.isArray(data.items)&&data.items.length){
      data.items.forEach(it=>addRow(it,true));
    }else{
      addRow({desc:"Product / Item",hsn:"",qty:1,unit:"pcs",rate:0},true);
    }

    syncShipToFromCustomer();
    recalc();
    return true;
  }catch(e){
    return false;
  }
}

function setTodayIfEmpty(){
  const el=document.getElementById("invoiceDate");
  if(el && !el.value){
    const d=new Date();
    const yyyy=d.getFullYear();
    const mm=String(d.getMonth()+1).padStart(2,"0");
    const dd=String(d.getDate()).padStart(2,"0");
    el.value = `${yyyy}-${mm}-${dd}`;
  }
}

function clearStorageAndReset(){
  localStorage.removeItem(STORAGE_KEY);
  logoDataUrl="";
  if(logoInput) logoInput.value="";

  document.querySelectorAll("input,select,textarea").forEach(el=>{
    if(el.id==="invoiceDate") return;
    if(el.id==="exportChargesTotal") return;
    if(el.type==="file") return;
    if(el.type==="checkbox"){ el.checked=false; return; }
    if(el.tagName==="SELECT"){ el.selectedIndex=0; return; }
    el.value="";
  });

  setField("currency","USD");
  setField("countryOrigin","India");
  setField("igstRate","0");
  setField("cgstRate","0");
  setField("sgstRate","0");
  setField("extraTax","0");
  setField("discount","0");
  setField("packingCharges","0");
  setField("freightCharges","0");
  setField("insuranceCharges","0");
  setField("otherCharges","0");

  const sameEl=document.getElementById("shipSameAsCustomer");
  if(sameEl) sameEl.checked=true;

  itemsBody.innerHTML="";
  addRow({desc:"Product / Item",hsn:"",qty:1,unit:"pcs",rate:0},true);

  setTodayIfEmpty();
  syncShipToFromCustomer();
  recalc();
  saveToStorage();
}

// ---------- Items ----------
function addRow(data={}, skipSave=false){
  const tr=document.createElement("tr");
  tr.innerHTML = `
    <td><input class="desc" placeholder="Item / Product description" value="${data.desc ?? ""}"></td>
    <td><input class="hsn" placeholder="HSN/HS" value="${data.hsn ?? ""}"></td>
    <td><input class="qty" type="number" step="0.01" value="${data.qty ?? 1}"></td>
    <td><input class="unit" placeholder="pcs / sqm / sheet" value="${data.unit ?? "pcs"}"></td>
    <td><input class="rate" type="number" step="0.01" value="${data.rate ?? 0}"></td>
    <td><input class="amt" type="number" step="0.01" value="0" readonly></td>
    <td><button class="removeBtn">Remove</button></td>
  `;
  tr.querySelector(".removeBtn").addEventListener("click", ()=>{
    tr.remove();
    recalc();
    saveToStorage();
  });

  ["input","change"].forEach(evt=>{
    tr.querySelector(".qty").addEventListener(evt, ()=>{ recalc(); saveToStorage(); });
    tr.querySelector(".rate").addEventListener(evt, ()=>{ recalc(); saveToStorage(); });
    tr.querySelector(".desc").addEventListener(evt, saveToStorage);
    tr.querySelector(".hsn").addEventListener(evt, saveToStorage);
    tr.querySelector(".unit").addEventListener(evt, saveToStorage);
  });

  itemsBody.appendChild(tr);
  recalc();
  if(!skipSave) saveToStorage();
}

function computeExportCharges(){
  const packing=toNum(packingChargesEl.value);
  const freight=toNum(freightChargesEl.value);
  const insurance=toNum(insuranceChargesEl.value);
  const other=toNum(otherChargesEl.value);
  const total=packing+freight+insurance+other;
  exportChargesTotalEl.value=money(total);
  return total;
}

function recalc(){
  let itemsSubtotal=0;
  [...itemsBody.querySelectorAll("tr")].forEach(tr=>{
    const qty=toNum(tr.querySelector(".qty").value);
    const rate=toNum(tr.querySelector(".rate").value);
    const amt=qty*rate;
    tr.querySelector(".amt").value=money(amt);
    itemsSubtotal+=amt;
  });

  const discount=toNum(discountEl.value);
  const exportChargesTotal=computeExportCharges();
  const taxableBase=Math.max(0, itemsSubtotal - discount) + exportChargesTotal;

  const gstType=gstTypeEl.value;
  const igstRate=toNum(igstRateEl.value);
  const cgstRate=toNum(cgstRateEl.value);
  const sgstRate=toNum(sgstRateEl.value);

  let igst=0,cgst=0,sgst=0;
  if(gstType==="IGST") igst=taxableBase*(igstRate/100);
  else if(gstType==="CGST_SGST"){
    cgst=taxableBase*(cgstRate/100);
    sgst=taxableBase*(sgstRate/100);
  }

  const gstTotal=igst+cgst+sgst;
  const extraTax=toNum(extraTaxEl.value);
  const grandTotal=taxableBase+gstTotal+extraTax;

  itemsSubtotalEl.textContent=money(itemsSubtotal);
  taxableBaseEl.textContent=money(taxableBase);
  gstTotalEl.textContent=money(gstTotal);
  extraTaxViewEl.textContent=money(extraTax);
  grandTotalEl.textContent=money(grandTotal);
}

// ---------- Logo upload ----------
if(logoInput){
  logoInput.addEventListener("change",(e)=>{
    const file=e.target.files?.[0];
    if(!file) return;
    const r=new FileReader();
    r.onload=()=>{
      logoDataUrl=String(r.result||"");
      saveToStorage();
      alert("Logo added ✅ Saved.");
    };
    r.readAsDataURL(file);
  });
}

// ---------- Listeners ----------
[
  discountEl, extraTaxEl, packingChargesEl, freightChargesEl, insuranceChargesEl, otherChargesEl,
  gstTypeEl, igstRateEl, cgstRateEl, sgstRateEl
].forEach(el=>el?.addEventListener("input", ()=>{ recalc(); saveToStorage(); }));

gstTypeEl?.addEventListener("change", ()=>{ recalc(); saveToStorage(); });

addRowBtn?.addEventListener("click", ()=>addRow());

saveBtn?.addEventListener("click", ()=>{ saveToStorage(); alert("Saved ✅"); });

clearBtn?.addEventListener("click", ()=>{
  const ok=confirm("Clear all saved data?");
  if(ok) clearStorageAndReset();
});

shipSameAsCustomerEl?.addEventListener("change", ()=>{
  syncShipToFromCustomer();
  saveToStorage();
});

["buyerName","buyerAddress","buyerCountry","buyerContact"].forEach(id=>{
  const el=document.getElementById(id);
  el?.addEventListener("input", ()=>{
    syncShipToFromCustomer();
    saveToStorage();
  });
});

document.addEventListener("input",(e)=>{
  const t=e.target;
  if(!t) return;
  if(t.id==="exportChargesTotal") return;
  if(t.type==="file") return;
  saveToStorage();
});

// ---------- INIT ----------
(function init(){
  const loaded = loadFromStorage();
  if(!loaded){
    itemsBody.innerHTML="";
    addRow({desc:"Product / Item",hsn:"",qty:1,unit:"pcs",rate:0},true);
    setTodayIfEmpty();

    const sameEl=document.getElementById("shipSameAsCustomer");
    if(sameEl) sameEl.checked=true;

    setField("currency","USD");
    setField("countryOrigin","India");
    setField("igstRate","0");
    setField("cgstRate","0");
    setField("sgstRate","0");
    setField("extraTax","0");
    setField("discount","0");
    setField("packingCharges","0");
    setField("freightCharges","0");
    setField("insuranceCharges","0");
    setField("otherCharges","0");

    syncShipToFromCustomer();
    recalc();
    saveToStorage();
  } else {
    syncShipToFromCustomer();
  }
})();

// ---------- Custom Fonts register (from fonts.js) ----------
function registerCustomFonts(doc){
  try{
    const f = window.__FONTS__ || {};

    // ITC Avant (Normal/Bold)
    if (f.ITCAvantNormal) {
      doc.addFileToVFS("ITCAvant-Normal.otf", f.ITCAvantNormal);
      doc.addFont("ITCAvant-Normal.otf", "ITCAvant", "normal");
    }
    if (f.ITCAvantBold) {
      doc.addFileToVFS("ITCAvant-Bold.otf", f.ITCAvantBold);
      doc.addFont("ITCAvant-Bold.otf", "ITCAvant", "bold");
    }

    // TT Fors (Normal/Bold)
    if (f.TTForsNormal) {
      doc.addFileToVFS("TTFors-Normal.ttf", f.TTForsNormal);
      doc.addFont("TTFors-Normal.ttf", "TTFors", "normal");
    }
    if (f.TTForsBold) {
      doc.addFileToVFS("TTFors-Bold.ttf", f.TTForsBold);
      doc.addFont("TTFors-Bold.ttf", "TTFors", "bold");
    }
  } catch (e) {
    console.warn("Font load failed, using default fonts.", e);
  }
}

function setHeadingFont(doc, style="bold"){
  try { doc.setFont("ITCAvant", style); }
  catch(e){ doc.setFont(undefined, style); }
}

function setBodyFont(doc, style="normal"){
  try { doc.setFont("TTFors", style); }
  catch(e){ doc.setFont(undefined, style); }
}

// ---------- PDF ----------
function buildPdf(returnDocOnly=false){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", format:"a4" });

  registerCustomFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const docType = getField("docType") || "PROFORMA INVOICE";
  const invoiceNo = getField("invoiceNo");
  const invoiceDate = getField("invoiceDate");
  const currency = (getField("currency") || "USD").toUpperCase();

  // Header background
  doc.setFillColor(245,245,250);
  doc.rect(0,0,pageW,100,"F");

  // Logo fixed size
  const logoW = cmToPt(5.77);
  const logoH = cmToPt(0.85);
  const logoX = margin;
  const logoY = 26;

  if(logoDataUrl){
    try{ doc.addImage(logoDataUrl, "PNG", logoX, logoY, logoW, logoH); }
    catch(e){ try{ doc.addImage(logoDataUrl, "JPEG", logoX, logoY, logoW, logoH);}catch(_){} }
  }

  // Title right
  doc.setTextColor(20);
  setHeadingFont(doc, "bold");
  doc.setFontSize(16);
  doc.text(docType, pageW - margin, 44, { align:"right" });

  // Info box under title
  const infoW = 220;
  const infoH = 54;
  const infoX = pageW - margin - infoW;
  const infoY = 56;
  drawBox(doc, infoX, infoY, infoW, infoH);

  setBodyFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(`Invoice No: ${safeText(invoiceNo)}`, infoX+12, infoY+20);
  doc.text(`Date: ${safeText(invoiceDate)}`, infoX+12, infoY+36);
  doc.text(`Currency: ${currency}`, infoX+12, infoY+52);

  // Terms
  const paymentTerms = getField("paymentTerms");
  const incoterms = getField("incoterms");
  const termsBasis = getField("termsBasis");

  setBodyFont(doc, "normal");
  doc.setFontSize(10);
  doc.text(`Payment Terms: ${safeText(paymentTerms)}`, margin, 130);
  doc.text(`Incoterms: ${safeText(incoterms)} | Terms Basis: ${safeText(termsBasis)}`, margin, 146);

  // SELLER full width (top)
  const startY = 165;
  const sellerBoxH = 85;

  drawBox(doc, margin, startY, pageW - margin * 2, sellerBoxH);

  setHeadingFont(doc, "bold");
  doc.setFontSize(11);
  doc.text("SELLER (YOUR COMPANY)", margin + 12, startY + 18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);

  const sellerAdCode = getField("sellerAdCode");
  const sellerText = [
    getField("sellerName"),
    getField("sellerAddress"),
    getField("sellerTax") ? `GST/VAT: ${getField("sellerTax")}` : "",
    getField("sellerPan") ? `PAN: ${getField("sellerPan")}` : "",
    getField("sellerIec") ? `IEC: ${getField("sellerIec")}` : "",
    sellerAdCode ? `AD Code: ${sellerAdCode}` : "",
    getField("sellerContact")
  ].filter(Boolean).join(" | ") || "-";

  doc.text(sellerText, margin + 12, startY + 40, { maxWidth: pageW - margin * 2 - 24 });

  // CUSTOMER | SHIP TO below
  const rowY = startY + sellerBoxH + 12;
  const gap = 14;
  const boxH = 120;
  const boxW = (pageW - margin * 2 - gap) / 2;

  // CUSTOMER
  const custX = margin;
  drawBox(doc, custX, rowY, boxW, boxH);

  setHeadingFont(doc, "bold");
  doc.setFontSize(11);
  doc.text("CUSTOMER", custX + 12, rowY + 18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);

  const custText = [
    getField("buyerName"),
    getField("buyerAddress"),
    getField("buyerCountry") ? `Country: ${getField("buyerCountry")}` : "",
    getField("buyerTax") ? `Tax ID: ${getField("buyerTax")}` : "",
    getField("buyerContact")
  ].filter(Boolean).join("\n") || "-";

  doc.text(custText, custX + 12, rowY + 36, { maxWidth: boxW - 24 });

  // SHIP TO
  const shipX = margin + boxW + gap;
  drawBox(doc, shipX, rowY, boxW, boxH);

  setHeadingFont(doc, "bold");
  doc.setFontSize(11);
  doc.text("SHIP TO", shipX + 12, rowY + 18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);

  const shipSame = !!document.getElementById("shipSameAsCustomer")?.checked;
  const shipText = shipSame ? custText : ([
    getField("shipName"),
    getField("shipAddress"),
    getField("shipCountry") ? `Country: ${getField("shipCountry")}` : "",
    getField("shipContact")
  ].filter(Boolean).join("\n") || "-");

  doc.text(shipText, shipX + 12, rowY + 36, { maxWidth: boxW - 24 });

  // Export & GST details full width
  const exY = rowY + boxH + 16;
  drawBox(doc, margin, exY, pageW - margin*2, 82);

  const gstType = getField("gstType");
  const gstLine =
    gstType === "IGST" ? `IGST ${safeText(getField("igstRate"),"0")}%` :
    gstType === "CGST_SGST" ? `CGST ${safeText(getField("cgstRate"),"0")}% + SGST ${safeText(getField("sgstRate"),"0")}%` :
    "None (Export LUT)";

  setHeadingFont(doc, "bold");
  doc.setFontSize(11);
  doc.text("EXPORT & GST DETAILS", margin+12, exY+18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);

  doc.text(
    [
      `Port Loading: ${safeText(getField("portLoading"))}   |   Port Discharge: ${safeText(getField("portDischarge"))}`,
      `Final Destination: ${safeText(getField("finalDestination"))}   |   Mode: ${safeText(getField("shipmentMode"))}`,
      `Origin: ${safeText(getField("countryOrigin"))}   |   Default HS: ${safeText(getField("defaultHs"))}`,
      `Place of Supply: ${safeText(getField("placeOfSupply"))}   |   GST: ${gstLine}   |   Validity: ${safeText(getField("validity"))}`
    ].join("\n"),
    margin+12, exY+36,
    { maxWidth: pageW - margin*2 - 24 }
  );

  // Items table
  const defaultHs = getField("defaultHs");
  const rows = [...itemsBody.querySelectorAll("tr")].map(tr => ([
    tr.querySelector(".desc").value.trim(),
    (tr.querySelector(".hsn").value.trim() || defaultHs || ""),
    tr.querySelector(".qty").value,
    tr.querySelector(".unit").value.trim(),
    tr.querySelector(".rate").value,
    tr.querySelector(".amt").value
  ]));

  doc.autoTable({
    startY: exY + 95,
    head: [["Description","HS Code","Qty","Unit","Rate","Amount"]],
    body: rows.length ? rows : [["-","-","-","-","-","-"]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, lineColor: [220,220,230], lineWidth: 0.6 },
    headStyles: { fillColor: [245,245,250], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252,252,255] },
    columnStyles: { 2:{halign:"right",cellWidth:48}, 4:{halign:"right",cellWidth:62}, 5:{halign:"right",cellWidth:78} },
    margin: { left: margin, right: margin }
  });

  let y = (doc.lastAutoTable.finalY || (exY + 200)) + 14;
  if (y > pageH - 320) { doc.addPage(); y = 60; }

  const itemsSubtotal = itemsSubtotalEl.textContent;
  const taxableBase = taxableBaseEl.textContent;
  const gstTotal = gstTotalEl.textContent;
  const extraTax = extraTaxViewEl.textContent;
  const grand = grandTotalEl.textContent;
  const inWords = amountInWords(toNum(grand), currency);

  // Two boxes (NO overlap)
  const boxGap2 = 14;
  const dualW = (pageW - margin*2 - boxGap2) / 2;
  const leftX = margin;
  const rightX = margin + dualW + boxGap2;
  const rightEdge = rightX + dualW - 12;

  drawBox(doc, leftX, y, dualW, 120);
  setHeadingFont(doc, "bold");
  doc.setFontSize(10);
  doc.text("EXPORT CHARGES BREAKDOWN", leftX+12, y+18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(`Packing: ${currency} ${money(toNum(packingChargesEl.value))}`, leftX+12, y+40);
  doc.text(`Freight: ${currency} ${money(toNum(freightChargesEl.value))}`, leftX+12, y+56);
  doc.text(`Insurance: ${currency} ${money(toNum(insuranceChargesEl.value))}`, leftX+12, y+72);
  doc.text(`Other: ${currency} ${money(toNum(otherChargesEl.value))}`, leftX+12, y+88);
  doc.text(`Total: ${currency} ${money(toNum(exportChargesTotalEl.value))}`, leftX+12, y+106);

  drawBox(doc, rightX, y, dualW, 120);
  setBodyFont(doc, "normal");
  doc.setFontSize(10);

  doc.text("Items Subtotal", rightX+12, y+28);
  doc.text(`${currency} ${itemsSubtotal}`, rightEdge, y+28, {align:"right"});

  doc.text("Taxable Base", rightX+12, y+48);
  doc.text(`${currency} ${taxableBase}`, rightEdge, y+48, {align:"right"});

  doc.text("GST Total", rightX+12, y+68);
  doc.text(`${currency} ${gstTotal}`, rightEdge, y+68, {align:"right"});

  doc.text("Extra Tax", rightX+12, y+88);
  doc.text(`${currency} ${extraTax}`, rightEdge, y+88, {align:"right"});

  setHeadingFont(doc, "bold");
  doc.text("GRAND TOTAL", rightX+12, y+110);
  doc.text(`${currency} ${grand}`, rightEdge, y+110, {align:"right"});

  // Amount in words
  const wordsY = y + 135;
  drawBox(doc, margin, wordsY, pageW - margin*2, 45);

  setHeadingFont(doc, "bold");
  doc.setFontSize(10);
  doc.text("AMOUNT IN WORDS", margin+12, wordsY+18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(inWords, margin+12, wordsY+35, {maxWidth: pageW - margin*2 - 24});

  // Bank / Notes
  let bnY = wordsY + 60;
  if (bnY > pageH - 220) { doc.addPage(); bnY = 60; }

  drawBox(doc, margin, bnY, pageW - margin*2, 90);
  setHeadingFont(doc, "bold");
  doc.setFontSize(10);
  doc.text("BANK DETAILS", margin+12, bnY+18);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(getField("bankDetails") || "As per company bank details on record.", margin+12, bnY+36, {
    maxWidth: pageW - margin*2 - 24
  });

  drawBox(doc, margin, bnY+100, pageW - margin*2, 80);
  setHeadingFont(doc, "bold");
  doc.setFontSize(10);
  doc.text("NOTES", margin+12, bnY+118);

  setBodyFont(doc, "normal");
  doc.setFontSize(9);
  doc.text(getField("notes") || "-", margin+12, bnY+136, {maxWidth: pageW - margin*2 - 24});

  doc.setFontSize(8);
  doc.setTextColor(120);
  setBodyFont(doc, "normal");
  doc.text("This is a computer generated document.", margin, pageH - 18);
  doc.setTextColor(20);

  const safeName = (invoiceNo || docType).replace(/[^\w\-]+/g,"_");
  if(returnDocOnly) return doc;
  doc.save(`${safeName}.pdf`);
  return doc;
}

// Print = PDF style print
if(printBtn){
  printBtn.addEventListener("click", ()=>{
    try{
      saveToStorage();
      const doc = buildPdf(true);
      const url = doc.output("bloburl");
      const w = window.open(url, "_blank");
      if(!w){ alert("Popup blocked. Allow popups and try again."); return; }
      w.onload = ()=>{ w.focus(); w.print(); };
    }catch(e){
      console.error(e);
      alert("Print error. Please try again.");
    }
  });
}

// Download PDF
downloadPdfBtn?.addEventListener("click", ()=>{ saveToStorage(); buildPdf(false); });
