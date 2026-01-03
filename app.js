// =====================
// State
// =====================
let logoDataUrl = ""; // base64 logo
const STORAGE_KEY = "invoice_site_v1";

// =====================
// DOM
// =====================
const itemsBody = document.getElementById("itemsBody");
const addRowBtn = document.getElementById("addRowBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

const saveBtn = document.getElementById("saveBtn");
const printBtn = document.getElementById("printBtn");
const clearBtn = document.getElementById("clearBtn");

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

const logoInput = document.getElementById("logoInput");

// =====================
// Helpers
// =====================
function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function money(n) {
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}
function getField(id) {
  return (document.getElementById(id)?.value ?? "").trim();
}
function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? "";
}
function drawBox(doc, x, y, w, h) {
  doc.setDrawColor(210);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, w, h, 8, 8);
}

// =====================
// Amount in Words (Indian numbering)
// =====================
function numberToWordsIndian(n) {
  n = Math.floor(n);
  if (!Number.isFinite(n) || n < 0) return "";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(num) {
    if (num < 20) return a[num];
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return b[tens] + (ones ? " " + a[ones] : "");
  }

  function threeDigits(num) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    let s = "";
    if (h) s += a[h] + " Hundred";
    if (rest) s += (s ? " " : "") + twoDigits(rest);
    return s;
  }

  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  n = n % 10000000;
  const lakh = Math.floor(n / 100000);
  n = n % 100000;
  const thousand = Math.floor(n / 1000);
  n = n % 1000;
  const hundredPart = n;

  let parts = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(threeDigits(lakh) + " Lakh");
  if (thousand) parts.push(threeDigits(thousand) + " Thousand");
  if (hundredPart) parts.push(threeDigits(hundredPart));

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function amountInWords(total, currencyCode) {
  const whole = Math.floor(total);
  const frac = Math.round((total - whole) * 100);

  let major = "Dollars";
  let minor = "Cents";

  const c = (currencyCode || "").toUpperCase();
  if (c === "INR") { major = "Rupees"; minor = "Paise"; }
  else if (c === "AED") { major = "Dirhams"; minor = "Fils"; }
  else if (c === "EUR") { major = "Euros"; minor = "Cents"; }
  else if (c === "GBP") { major = "Pounds"; minor = "Pence"; }
  else if (c === "SAR") { major = "Riyals"; minor = "Halalas"; }

  const wholeWords = numberToWordsIndian(whole) + " " + major;
  const fracWords = frac ? (" and " + numberToWordsIndian(frac) + " " + minor) : "";
  return (wholeWords + fracWords + " Only").replace(/\s+/g, " ").trim();
}

// =====================
// Auto-save (localStorage)
// =====================
function collectFormState() {
  const ids = [
    "docType","invoiceNo","invoiceDate","currency","paymentTerms","incoterms","placeOfSupply",
    "gstType","igstRate","cgstRate","sgstRate","extraTax",
    "sellerName","sellerAddress","sellerTax","sellerPan","sellerIec","sellerContact",
    "buyerName","buyerAddress","buyerCountry","buyerTax","buyerContact",
    "portLoading","portDischarge","finalDestination","countryOrigin","shipmentMode","defaultHs","termsBasis","validity",
    "packingCharges","freightCharges","insuranceCharges","otherCharges","discount",
    "bankDetails","notes"
  ];

  const data = {};
  ids.forEach(id => data[id] = getField(id));

  data.items = [...itemsBody.querySelectorAll("tr")].map(tr => ({
    desc: tr.querySelector(".desc").value,
    hsn: tr.querySelector(".hsn").value,
    qty: tr.querySelector(".qty").value,
    unit: tr.querySelector(".unit").value,
    rate: tr.querySelector(".rate").value
  }));

  data.logoDataUrl = logoDataUrl;

  return data;
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormState()));
  } catch (e) {
    // ignore
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    Object.keys(data).forEach(key => {
      if (key === "items" || key === "logoDataUrl") return;
      setField(key, data[key]);
    });

    if (data.logoDataUrl) logoDataUrl = data.logoDataUrl;

    itemsBody.innerHTML = "";
    if (Array.isArray(data.items) && data.items.length) {
      data.items.forEach(it => addRow(it, true));
    } else {
      addRow({ desc: "Product / Item", hsn: "", qty: 1, unit: "pcs", rate: 0 }, true);
    }

    setTodayIfEmpty();
    recalc();
    return true;
  } catch (e) {
    return false;
  }
}

function clearStorageAndReset() {
  localStorage.removeItem(STORAGE_KEY);
  logoDataUrl = "";
  if (logoInput) logoInput.value = "";

  // reset inputs
  document.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.id === "invoiceDate") return;
    if (el.id === "exportChargesTotal") return;
    if (el.type === "file") return;
    if (el.tagName === "SELECT") { el.selectedIndex = 0; return; }
    el.value = "";
  });

  // defaults
  setField("currency", "USD");
  setField("countryOrigin", "India");
  setField("igstRate", "0");
  setField("cgstRate", "0");
  setField("sgstRate", "0");
  setField("extraTax", "0");
  setField("discount", "0");
  setField("packingCharges", "0");
  setField("freightCharges", "0");
  setField("insuranceCharges", "0");
  setField("otherCharges", "0");

  itemsBody.innerHTML = "";
  addRow({ desc: "Product / Item", hsn: "", qty: 1, unit: "pcs", rate: 0 }, true);

  setTodayIfEmpty();
  recalc();
  saveToStorage();
}

// =====================
// Logo upload
// =====================
if (logoInput) {
  logoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result || "");
      saveToStorage();
      alert("Logo added ✅ Saved.");
    };
    reader.readAsDataURL(file);
  });
}

// =====================
// Items rows
// =====================
function addRow(data = {}, skipSave = false) {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input class="desc" placeholder="Item / Product description" value="${data.desc ?? ""}"></td>
    <td><input class="hsn" placeholder="HSN/HS" value="${data.hsn ?? ""}"></td>
    <td><input class="qty" type="number" step="0.01" value="${data.qty ?? 1}"></td>
    <td><input class="unit" placeholder="pcs / sqm / sheet" value="${data.unit ?? "pcs"}"></td>
    <td><input class="rate" type="number" step="0.01" value="${data.rate ?? 0}"></td>
    <td><input class="amt" type="number" step="0.01" value="0" readonly></td>
    <td><button class="removeBtn">Remove</button></td>
  `;

  tr.querySelector(".removeBtn").addEventListener("click", () => {
    tr.remove();
    recalc();
    saveToStorage();
  });

  const watch = (sel) => {
    const el = tr.querySelector(sel);
    ["input", "change"].forEach(evt => el.addEventListener(evt, () => {
      recalc();
      saveToStorage();
    }));
  };
  watch(".qty");
  watch(".rate");

  // non-calc fields still should save
  [".desc",".hsn",".unit"].forEach(sel => {
    const el = tr.querySelector(sel);
    ["input","change"].forEach(evt => el.addEventListener(evt, () => saveToStorage()));
  });

  itemsBody.appendChild(tr);
  recalc();
  if (!skipSave) saveToStorage();
}

function computeExportCharges() {
  const packing = toNum(packingChargesEl.value);
  const freight = toNum(freightChargesEl.value);
  const insurance = toNum(insuranceChargesEl.value);
  const other = toNum(otherChargesEl.value);
  const total = packing + freight + insurance + other;
  exportChargesTotalEl.value = money(total);
  return total;
}

function recalc() {
  let itemsSubtotal = 0;

  [...itemsBody.querySelectorAll("tr")].forEach(tr => {
    const qty = toNum(tr.querySelector(".qty").value);
    const rate = toNum(tr.querySelector(".rate").value);
    const amt = qty * rate;
    tr.querySelector(".amt").value = money(amt);
    itemsSubtotal += amt;
  });

  const discount = toNum(discountEl.value);
  const exportChargesTotal = computeExportCharges();
  const taxableBase = Math.max(0, itemsSubtotal - discount) + exportChargesTotal;

  const gstType = gstTypeEl.value;
  const igstRate = toNum(igstRateEl.value);
  const cgstRate = toNum(cgstRateEl.value);
  const sgstRate = toNum(sgstRateEl.value);

  let igst = 0, cgst = 0, sgst = 0;
  if (gstType === "IGST") igst = taxableBase * (igstRate / 100);
  else if (gstType === "CGST_SGST") {
    cgst = taxableBase * (cgstRate / 100);
    sgst = taxableBase * (sgstRate / 100);
  }

  const gstTotal = igst + cgst + sgst;
  const extraTax = toNum(extraTaxEl.value);
  const grandTotal = taxableBase + gstTotal + extraTax;

  itemsSubtotalEl.textContent = money(itemsSubtotal);
  taxableBaseEl.textContent = money(taxableBase);
  gstTotalEl.textContent = money(gstTotal);
  extraTaxViewEl.textContent = money(extraTax);
  grandTotalEl.textContent = money(grandTotal);
}

// =====================
// Date default
// =====================
function setTodayIfEmpty() {
  const el = document.getElementById("invoiceDate");
  if (el && !el.value) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    el.value = `${yyyy}-${mm}-${dd}`;
  }
}

// =====================
// Init + Listeners
// =====================
[
  discountEl,
  extraTaxEl,
  packingChargesEl,
  freightChargesEl,
  insuranceChargesEl,
  otherChargesEl,
  gstTypeEl,
  igstRateEl,
  cgstRateEl,
  sgstRateEl
].forEach(el => el.addEventListener("input", () => { recalc(); saveToStorage(); }));

gstTypeEl.addEventListener("change", () => { recalc(); saveToStorage(); });

if (addRowBtn) addRowBtn.addEventListener("click", () => addRow());

if (saveBtn) saveBtn.addEventListener("click", () => { saveToStorage(); alert("Saved ✅"); });

if (clearBtn) clearBtn.addEventListener("click", () => {
  const ok = confirm("Clear all saved data?");
  if (ok) clearStorageAndReset();
});

// Print = SAME PDF layout (open PDF in new tab then print)
if (printBtn) {
  printBtn.addEventListener("click", () => {
    try {
      saveToStorage();

      const doc = buildPdf(true); // return pdf only
      const blobUrl = doc.output("bloburl");
      const w = window.open(blobUrl, "_blank");

      if (!w) {
        alert("Popup blocked. Please allow popups and try again.");
        return;
      }

      w.onload = () => {
        w.focus();
        w.print();
      };
    } catch (e) {
      console.error(e);
      alert("Print error. Please try again.");
    }
  });
}

// Auto-save for all inputs/selects/textareas
document.addEventListener("input", (e) => {
  const t = e.target;
  if (!t) return;
  if (t.id === "exportChargesTotal") return;
  if (t.type === "file") return;
  saveToStorage();
});

(function init() {
  const loaded = loadFromStorage();
  if (!loaded) {
    itemsBody.innerHTML = "";
    addRow({ desc: "Product / Item", hsn: "", qty: 1, unit: "pcs", rate: 0 }, true);

    setTodayIfEmpty();
    setField("currency", "USD");
    setField("countryOrigin", "India");
    setField("igstRate", "0");
    setField("cgstRate", "0");
    setField("sgstRate", "0");
    setField("extraTax", "0");
    setField("discount", "0");
    setField("packingCharges", "0");
    setField("freightCharges", "0");
    setField("insuranceCharges", "0");
    setField("otherCharges", "0");

    recalc();
    saveToStorage();
  }
})();

// =====================
// PDF (Professional + Amount in Words)
// returnDocOnly=true => return doc instead of saving
// =====================
function buildPdf(returnDocOnly = false) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const docType = getField("docType") || "PROFORMA INVOICE";
  const invoiceNo = getField("invoiceNo");
  const invoiceDate = getField("invoiceDate");
  const currency = (getField("currency") || "USD").toUpperCase();
  const paymentTerms = getField("paymentTerms");
  const incoterms = getField("incoterms");
  const termsBasis = getField("termsBasis");
  const placeOfSupply = getField("placeOfSupply");

  const gstType = getField("gstType");
  const igstRate = getField("igstRate");
  const cgstRate = getField("cgstRate");
  const sgstRate = getField("sgstRate");

  const sellerName = getField("sellerName");
  const sellerAddress = getField("sellerAddress");
  const sellerTax = getField("sellerTax");
  const sellerPan = getField("sellerPan");
  const sellerIec = getField("sellerIec");
  const sellerContact = getField("sellerContact");

  const buyerName = getField("buyerName");
  const buyerAddress = getField("buyerAddress");
  const buyerCountry = getField("buyerCountry");
  const buyerTax = getField("buyerTax");
  const buyerContact = getField("buyerContact");

  const portLoading = getField("portLoading");
  const portDischarge = getField("portDischarge");
  const finalDestination = getField("finalDestination");
  const countryOrigin = getField("countryOrigin");
  const shipmentMode = getField("shipmentMode");
  const defaultHs = getField("defaultHs");
  const validity = getField("validity");

  const packing = money(toNum(packingChargesEl.value));
  const freight = money(toNum(freightChargesEl.value));
  const insurance = money(toNum(insuranceChargesEl.value));
  const other = money(toNum(otherChargesEl.value));
  const exportChargesTotal = money(toNum(exportChargesTotalEl.value));

  const bankDetails = getField("bankDetails");
  const notes = getField("notes");

  // Header band
  doc.setFillColor(245, 245, 250);
  doc.rect(0, 0, pageW, 92, "F");

  // Logo
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", margin, 18, 92, 46); }
    catch (e) {
      try { doc.addImage(logoDataUrl, "JPEG", margin, 18, 92, 46); } catch (_) {}
    }
  }

  doc.setTextColor(20);
  doc.setFontSize(16);
  doc.text(docType, pageW / 2, 42, { align: "center" });

  // Right info box
  const rightX = pageW - margin - 230;
  drawBox(doc, rightX, 18, 230, 58);
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoiceNo || "-"}`, rightX + 12, 40);
  doc.text(`Date: ${invoiceDate || "-"}`, rightX + 12, 55);
  doc.text(`Currency: ${currency}`, rightX + 12, 70);

  // Terms
  doc.setFontSize(10);
  doc.text(`Payment Terms: ${paymentTerms || "-"}`, margin, 112);
  doc.text(`Incoterms: ${incoterms || "-"} | Terms Basis: ${termsBasis || "-"}`, margin, 128);

  // Seller / Buyer boxes
  const boxY = 145;
  const boxH = 110;
  const gap = 14;
  const boxW = (pageW - margin * 2 - gap) / 2;

  drawBox(doc, margin, boxY, boxW, boxH);
  drawBox(doc, margin + boxW + gap, boxY, boxW, boxH);

  doc.setFontSize(11);
  doc.text("SELLER", margin + 12, boxY + 18);
  doc.setFontSize(9);
  doc.text(
    [
      sellerName,
      sellerAddress,
      sellerTax ? `GST/VAT: ${sellerTax}` : "",
      sellerPan ? `PAN: ${sellerPan}` : "",
      sellerIec ? `IEC: ${sellerIec}` : "",
      sellerContact
    ].filter(Boolean).join("\n") || "-",
    margin + 12, boxY + 34,
    { maxWidth: boxW - 24 }
  );

  doc.setFontSize(11);
  doc.text("BUYER", margin + boxW + gap + 12, boxY + 18);
  doc.setFontSize(9);
  doc.text(
    [
      buyerName,
      buyerAddress,
      buyerCountry ? `Country: ${buyerCountry}` : "",
      buyerTax ? `Tax ID: ${buyerTax}` : "",
      buyerContact
    ].filter(Boolean).join("\n") || "-",
    margin + boxW + gap + 12, boxY + 34,
    { maxWidth: boxW - 24 }
  );

  // Export & GST box
  const exY = boxY + boxH + 16;
  drawBox(doc, margin, exY, pageW - margin * 2, 80);

  const gstLine =
    gstType === "IGST" ? `IGST ${igstRate}%` :
    gstType === "CGST_SGST" ? `CGST ${cgstRate}% + SGST ${sgstRate}%` :
    "None (Export LUT)";

  doc.setFontSize(11);
  doc.text("EXPORT & GST DETAILS", margin + 12, exY + 18);

  doc.setFontSize(9);
  doc.text(
    [
      `Port Loading: ${portLoading || "-"}   |   Port Discharge: ${portDischarge || "-"}`,
      `Final Destination: ${finalDestination || "-"}   |   Mode: ${shipmentMode || "-"}`,
      `Origin: ${countryOrigin || "-"}   |   Default HS: ${defaultHs || "-"}`,
      `Place of Supply: ${placeOfSupply || "-"}   |   GST: ${gstLine}   |   Validity: ${validity || "-"}`
    ].join("\n"),
    margin + 12, exY + 36,
    { maxWidth: pageW - margin * 2 - 24 }
  );

  // Items table
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
    head: [["Description", "HS Code", "Qty", "Unit", "Rate", "Amount"]],
    body: rows.length ? rows : [["-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, lineColor: [220, 220, 230], lineWidth: 0.6 },
    headStyles: { fillColor: [245, 245, 250], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252, 252, 255] },
    columnStyles: {
      2: { halign: "right", cellWidth: 48 },
      4: { halign: "right", cellWidth: 62 },
      5: { halign: "right", cellWidth: 78 }
    },
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

  // =====================
  // CHARGES + TOTALS (NO OVERLAP FIX)
  // =====================
  const boxGap2 = 14;
  const halfW = (pageW - margin * 2 - boxGap2) / 2;
  const leftX = margin;
  const rightBoxX = margin + halfW + boxGap2;

  drawBox(doc, leftX, y, halfW, 120);
  doc.setFontSize(10);
  doc.text("EXPORT CHARGES BREAKDOWN", leftX + 12, y + 18);
  doc.setFontSize(9);
  doc.text(`Packing: ${currency} ${packing}`, leftX + 12, y + 40);
  doc.text(`Freight: ${currency} ${freight}`, leftX + 12, y + 56);
  doc.text(`Insurance: ${currency} ${insurance}`, leftX + 12, y + 72);
  doc.text(`Other: ${currency} ${other}`, leftX + 12, y + 88);
  doc.text(`Total: ${currency} ${exportChargesTotal}`, leftX + 12, y + 106);

  drawBox(doc, rightBoxX, y, halfW, 120);
  const rightTextX = rightBoxX + 12;
  const rightValueX = rightBoxX + halfW - 12;

  doc.setFontSize(10);
  doc.text("Items Subtotal", rightTextX, y + 28);
  doc.text(`${currency} ${itemsSubtotal}`, rightValueX, y + 28, { align: "right" });

  doc.text("Taxable Base", rightTextX, y + 48);
  doc.text(`${currency} ${taxableBase}`, rightValueX, y + 48, { align: "right" });

  doc.text("GST Total", rightTextX, y + 68);
  doc.text(`${currency} ${gstTotal}`, rightValueX, y + 68, { align: "right" });

  doc.text("Extra Tax", rightTextX, y + 88);
  doc.text(`${currency} ${extraTax}`, rightValueX, y + 88, { align: "right" });

  doc.setFont(undefined, "bold");
  doc.text("GRAND TOTAL", rightTextX, y + 110);
  doc.text(`${currency} ${grand}`, rightValueX, y + 110, { align: "right" });
  doc.setFont(undefined, "normal");

  // Amount in Words box
  const wordsY = y + 135;
  drawBox(doc, margin, wordsY, pageW - margin * 2, 45);
  doc.setFontSize(10);
  doc.text("AMOUNT IN WORDS", margin + 12, wordsY + 18);
  doc.setFontSize(9);
  doc.text(inWords, margin + 12, wordsY + 35, { maxWidth: pageW - margin * 2 - 24 });

  // Bank / Notes
  let bnY = wordsY + 60;
  if (bnY > pageH - 220) { doc.addPage(); bnY = 60; }

  drawBox(doc, margin, bnY, pageW - margin * 2, 90);
  doc.setFontSize(10);
  doc.text("BANK DETAILS", margin + 12, bnY + 18);
  doc.setFontSize(9);
  doc.text(bankDetails || "As per company bank details on record.", margin + 12, bnY + 36, {
    maxWidth: pageW - margin * 2 - 24
  });

  drawBox(doc, margin, bnY + 100, pageW - margin * 2, 80);
  doc.setFontSize(10);
  doc.text("NOTES", margin + 12, bnY + 118);
  doc.setFontSize(9);
  doc.text(notes || "-", margin + 12, bnY + 136, { maxWidth: pageW - margin * 2 - 24 });

  // Signature
  const sigY = bnY + 190;
  if (sigY < pageH - 70) {
    drawBox(doc, margin, sigY, 260, 60);
    doc.setFontSize(10);
    doc.text("Authorized Signatory", margin + 12, sigY + 22);
    doc.setTextColor(120);
    doc.setFontSize(9);
    doc.text("(Signature & Stamp)", margin + 12, sigY + 40);
    doc.setTextColor(20);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("This is a computer generated document.", margin, pageH - 18);
  doc.setTextColor(20);

  const safeName = (invoiceNo || docType).replace(/[^\w\-]+/g, "_");

  if (returnDocOnly) return doc;
  doc.save(`${safeName}.pdf`);
  return doc;
}

// Download PDF (also saves first)
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => {
    saveToStorage();
    buildPdf(false);
  });
}
