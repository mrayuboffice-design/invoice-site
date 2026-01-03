// =====================
// State
// =====================
let logoDataUrl = ""; // base64 logo

// =====================
// DOM
// =====================
const itemsBody = document.getElementById("itemsBody");
const addRowBtn = document.getElementById("addRowBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

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
function toNum(v){
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function money(n){
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
}
function getField(id){
  return (document.getElementById(id)?.value ?? "").trim();
}

function drawBox(doc, x, y, w, h) {
  doc.setDrawColor(210);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, w, h, 8, 8);
}

// =====================
// Logo upload (IMPORTANT)
// =====================
if (logoInput) {
  logoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      logoDataUrl = String(reader.result || "");
      alert("Logo added ✅ Now download PDF again.");
    };
    reader.readAsDataURL(file);
  });
}

// =====================
// Items rows
// =====================
function addRow(data = {}) {
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
  });

  ["input", "change"].forEach(evt => {
    tr.querySelector(".qty").addEventListener(evt, recalc);
    tr.querySelector(".rate").addEventListener(evt, recalc);
  });

  itemsBody.appendChild(tr);
  recalc();
}

function computeExportCharges(){
  const packing = toNum(packingChargesEl.value);
  const freight = toNum(freightChargesEl.value);
  const insurance = toNum(insuranceChargesEl.value);
  const other = toNum(otherChargesEl.value);
  const total = packing + freight + insurance + other;
  exportChargesTotalEl.value = money(total);
  return total;
}

function recalc(){
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

  if (gstType === "IGST") {
    igst = taxableBase * (igstRate / 100);
  } else if (gstType === "CGST_SGST") {
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

// listeners
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
].forEach(el => el.addEventListener("input", recalc));

gstTypeEl.addEventListener("change", recalc);

addRowBtn.addEventListener("click", () => addRow());

// default row
addRow({ desc: "Stone Veneer / Product", hsn: "", qty: 1, unit: "pcs", rate: 0 });

// Set default date = today
(function setToday(){
  const el = document.getElementById("invoiceDate");
  if (el && !el.value) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    el.value = `${yyyy}-${mm}-${dd}`;
  }
})();

// =====================
// Professional PDF
// =====================
function buildPdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Doc fields
  const docType = getField("docType") || "PROFORMA INVOICE";
  const invoiceNo = getField("invoiceNo");
  const invoiceDate = getField("invoiceDate");
  const currency = (getField("currency") || "USD").toUpperCase();
  const paymentTerms = getField("paymentTerms");
  const incoterms = getField("incoterms");
  const termsBasis = getField("termsBasis");
  const placeOfSupply = getField("placeOfSupply");

  // GST
  const gstType = getField("gstType");
  const igstRate = getField("igstRate");
  const cgstRate = getField("cgstRate");
  const sgstRate = getField("sgstRate");

  // Seller
  const sellerName = getField("sellerName");
  const sellerAddress = getField("sellerAddress");
  const sellerTax = getField("sellerTax");
  const sellerPan = getField("sellerPan");
  const sellerIec = getField("sellerIec");
  const sellerContact = getField("sellerContact");

  // Buyer
  const buyerName = getField("buyerName");
  const buyerAddress = getField("buyerAddress");
  const buyerCountry = getField("buyerCountry");
  const buyerTax = getField("buyerTax");
  const buyerContact = getField("buyerContact");

  // Export
  const portLoading = getField("portLoading");
  const portDischarge = getField("portDischarge");
  const finalDestination = getField("finalDestination");
  const countryOrigin = getField("countryOrigin");
  const shipmentMode = getField("shipmentMode");
  const defaultHs = getField("defaultHs");
  const validity = getField("validity");

  // Charges
  const packing = money(toNum(packingChargesEl.value));
  const freight = money(toNum(freightChargesEl.value));
  const insurance = money(toNum(insuranceChargesEl.value));
  const other = money(toNum(otherChargesEl.value));
  const exportChargesTotal = money(toNum(exportChargesTotalEl.value));

  // Notes
  const bankDetails = getField("bankDetails");
  const notes = getField("notes");

  // =======================
  // Header band
  // =======================
  doc.setFillColor(245, 245, 250);
  doc.rect(0, 0, pageW, 90, "F");

  // Logo
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, 18, 95, 45);
    } catch (e) {
      try { doc.addImage(logoDataUrl, "JPEG", margin, 18, 95, 45); } catch(_) {}
    }
  }

  // Title center
  doc.setTextColor(20);
  doc.setFontSize(16);
  doc.text(docType, pageW / 2, 40, { align: "center" });

  // Right info box
  const rightX = pageW - margin - 220;
  drawBox(doc, rightX, 18, 220, 55);
  doc.setFontSize(10);
  doc.text(`Invoice No: ${invoiceNo || "-"}`, rightX + 12, 38);
  doc.text(`Date: ${invoiceDate || "-"}`, rightX + 12, 52);
  doc.text(`Currency: ${currency}`, rightX + 12, 66);

  // Terms line
  doc.setFontSize(10);
  doc.text(`Payment Terms: ${paymentTerms || "-"}`, margin, 110);
  doc.text(`Incoterms: ${incoterms || "-"} | Terms Basis: ${termsBasis || "-"}`, margin, 126);

  // =======================
  // Seller / Buyer boxes
  // =======================
  const boxY = 145;
  const boxH = 95;
  const gap = 14;
  const boxW = (pageW - margin * 2 - gap) / 2;

  drawBox(doc, margin, boxY, boxW, boxH);
  drawBox(doc, margin + boxW + gap, boxY, boxW, boxH);

  doc.setFontSize(11);
  doc.text("Seller", margin + 12, boxY + 18);
  doc.setFontSize(10);
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
  doc.text("Buyer", margin + boxW + gap + 12, boxY + 18);
  doc.setFontSize(10);
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

  // =======================
  // Export & GST block
  // =======================
  const exY = boxY + boxH + 15;
  drawBox(doc, margin, exY, pageW - margin * 2, 70);

  doc.setFontSize(11);
  doc.text("Export & GST", margin + 12, exY + 18);

  const gstLine =
    gstType === "IGST" ? `GST: IGST ${igstRate}%` :
    gstType === "CGST_SGST" ? `GST: CGST ${cgstRate}% + SGST ${sgstRate}%` :
    "GST: None (Export LUT)";

  doc.setFontSize(10);
  doc.text(
    [
      `Port Loading: ${portLoading || "-"} | Port Discharge: ${portDischarge || "-"}`,
      `Final Destination: ${finalDestination || "-"} | Mode: ${shipmentMode || "-"}`,
      `Origin: ${countryOrigin || "-"} | Default HS: ${defaultHs || "-"}`,
      `Place of Supply: ${placeOfSupply || "-"} | ${gstLine} | Validity: ${validity || "-"}`,
    ].join("\n"),
    margin + 12, exY + 34,
    { maxWidth: pageW - margin * 2 - 24 }
  );

  // =======================
  // Items table
  // =======================
  const rows = [...itemsBody.querySelectorAll("tr")].map(tr => ([
    tr.querySelector(".desc").value.trim(),
    (tr.querySelector(".hsn").value.trim() || defaultHs || ""),
    tr.querySelector(".qty").value,
    tr.querySelector(".unit").value.trim(),
    tr.querySelector(".rate").value,
    tr.querySelector(".amt").value
  ]));

  doc.autoTable({
    startY: exY + 85,
    head: [["Description", "HSN/HS", "Qty", "Unit", "Rate", "Amount"]],
    body: rows.length ? rows : [["-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, lineColor: [220,220,230], lineWidth: 0.6 },
    headStyles: { fillColor: [245,245,250], textColor: 20, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [252,252,255] },
    columnStyles: {
      0: { cellWidth: 230 },
      1: { cellWidth: 75 },
      2: { halign: "right", cellWidth: 45 },
      3: { cellWidth: 55 },
      4: { halign: "right", cellWidth: 60 },
      5: { halign: "right", cellWidth: 70 }
    },
    margin: { left: margin, right: margin }
  });

  const y = doc.lastAutoTable.finalY || (exY + 200);

  // =======================
  // Totals box (right)
  // =======================
  const itemsSubtotal = itemsSubtotalEl.textContent;
  const taxableBase = taxableBaseEl.textContent;
  const gstTotal = gstTotalEl.textContent;
  const extraTax = extraTaxViewEl.textContent;
  const grand = grandTotalEl.textContent;

  const totalsX = pageW - margin - 260;
  const totalsY = y + 16;

  drawBox(doc, totalsX, totalsY, 260, 115);

  doc.setFontSize(10);
  doc.text("Items Subtotal", totalsX + 12, totalsY + 22);
  doc.text(`${currency} ${itemsSubtotal}`, totalsX + 248, totalsY + 22, { align: "right" });

  doc.text("Export Charges", totalsX + 12, totalsY + 40);
  doc.text(`${currency} ${exportChargesTotal}`, totalsX + 248, totalsY + 40, { align: "right" });

  doc.text("Taxable Base", totalsX + 12, totalsY + 58);
  doc.text(`${currency} ${taxableBase}`, totalsX + 248, totalsY + 58, { align: "right" });

  doc.text("GST Total", totalsX + 12, totalsY + 76);
  doc.text(`${currency} ${gstTotal}`, totalsX + 248, totalsY + 76, { align: "right" });

  doc.text("Extra Tax", totalsX + 12, totalsY + 94);
  doc.text(`${currency} ${extraTax}`, totalsX + 248, totalsY + 94, { align: "right" });

  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Grand Total", totalsX + 12, totalsY + 113);
  doc.text(`${currency} ${grand}`, totalsX + 248, totalsY + 113, { align: "right" });
  doc.setFont(undefined, "normal");

  // =======================
  // Export charges left block (optional)
  // =======================
  const chargesX = margin;
  const chargesY = totalsY;

  drawBox(doc, chargesX, chargesY, 270, 115);
  doc.setFontSize(10);
  doc.text("Export Charges Breakdown", chargesX + 12, chargesY + 18);
  doc.setFontSize(9);
  doc.text(`Packing: ${currency} ${packing}`, chargesX + 12, chargesY + 38);
  doc.text(`Freight: ${currency} ${freight}`, chargesX + 12, chargesY + 54);
  doc.text(`Insurance: ${currency} ${insurance}`, chargesX + 12, chargesY + 70);
  doc.text(`Other: ${currency} ${other}`, chargesX + 12, chargesY + 86);
  doc.text(`Total: ${currency} ${exportChargesTotal}`, chargesX + 12, chargesY + 102);

  // =======================
  // Bank / Notes
  // =======================
  const bnY = chargesY + 135;

  drawBox(doc, margin, bnY, pageW - margin * 2, 90);
  doc.setFontSize(10);
  doc.text("Bank Details", margin + 12, bnY + 18);
  doc.setFontSize(9);
  doc.text(bankDetails || "-", margin + 12, bnY + 35, { maxWidth: pageW - margin * 2 - 24 });

  drawBox(doc, margin, bnY + 100, pageW - margin * 2, 80);
  doc.setFontSize(10);
  doc.text("Notes", margin + 12, bnY + 118);
  doc.setFontSize(9);
  doc.text(notes || "-", margin + 12, bnY + 135, { maxWidth: pageW - margin * 2 - 24 });

  // =======================
  // Signature + Footer
  // =======================
  const sigY = bnY + 190;
  drawBox(doc, margin, sigY, 260, 65);
  doc.setFontSize(10);
  doc.text("Authorized Signatory", margin + 12, sigY + 22);
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text("(Signature & Stamp)", margin + 12, sigY + 42);
  doc.setTextColor(20);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("This is a computer generated document.", margin, pageH - 20);
  doc.setTextColor(20);

  const safeName = (invoiceNo || docType).replace(/[^\w\-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}

downloadPdfBtn.addEventListener("click", buildPdf);
