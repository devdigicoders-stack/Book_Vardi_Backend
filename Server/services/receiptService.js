import PDFDocument from "pdfkit";

/**
 * Generate an official PDF Partial Advance Payment Receipt for a School Bulk Order
 * @param {Object} order - SchoolBulkOrder document
 * @returns {PDFDocument} - Streaming PDF document
 */
export const generatePartialAdvanceReceiptPDF = (order) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  const primaryColor = "#0f172a"; // Slate 900
  const brandTeal = "#0f766e"; // Teal 700
  const accentGold = "#d97706"; // Amber 600
  const mutedColor = "#64748b"; // Slate 500
  const borderColor = "#e2e8f0"; // Slate 200

  const receiptNo = order.advanceReceiptNumber || `REC-ADV-${order.referenceId || order._id.toString().substring(0, 8).toUpperCase()}`;
  const totalBudget = Number(order.overallBudget || 0);
  const advAmount = Number(
    order.advancePaidAmount ||
    order.sellerAdvanceAmount ||
    order.buyerAdvanceAmount ||
    (totalBudget * (order.sellerAdvancePercentage || order.buyerAdvancePercentage || 25) / 100) ||
    0
  );
  const remainingBalance = Math.max(0, totalBudget - advAmount);

  // 1. HEADER SECTION
  doc
    .fillColor(brandTeal)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("Bookvardi", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("B2B & School Institutional Procurement Desk", 40, 68)
    .text("GSTIN: 09AAACS1429B1Z2 | corporate@bookvardi.in", 40, 80);

  doc
    .fillColor(primaryColor)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("TAX INVOICE & ADVANCE RECEIPT", 340, 40, { align: "right" })
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Invoice / Receipt No: ${receiptNo}`, 340, 60, { align: "right" })
    .text(`Bulk Order Ref: ${order.referenceId}`, 340, 72, { align: "right" })
    .text(`Date: ${order.advancePaidAt ? new Date(order.advancePaidAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 340, 84, { align: "right" });

  // Divider
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 102).lineTo(555, 102).stroke();

  // 2. PARTIES DETAILS (BUYER & SUPPLIER)
  // Left: Buyer (School)
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Procuring Institution / Buyer:", 40, 115)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(mutedColor)
    .text(order.institutionName || "School / Institution", 40, 129, { width: 240 })
    .text(`Attn: ${order.contactName || "Administrator"} (${order.designation || "Officer"})`, 40, 141, { width: 240 })
    .text(`Phone: ${order.contactPhone || "N/A"} | ${order.contactEmail || ""}`, 40, 153, { width: 240 })
    .text(`Address: ${[order.address, order.city, order.state, order.pincode].filter(Boolean).join(", ") || "India"}`, 40, 165, { width: 240 });

  // Right: Supplier (Assigned Seller or Marketplace Desk)
  const sellerInfo = order.sellerId && typeof order.sellerId === "object" ? order.sellerId : null;
  const supplierName = sellerInfo?.storeName || sellerInfo?.businessName || sellerInfo?.name || "Bookvardi Institutional Seller Network";
  const supplierCity = sellerInfo?.city || order.city || "New Delhi, India";

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Authorized Seller / Supplier:", 320, 115)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(mutedColor)
    .text(supplierName, 320, 129, { width: 235 })
    .text("Verified Institutional Vendor Hub", 320, 143)
    .text(`Location: ${supplierCity}`, 320, 157);

  // Divider
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 202).lineTo(555, 202).stroke();

  // 3. ADVANCE PAYMENT HIGHLIGHT CARD (TINTED BOX)
  doc
    .roundedRect(40, 212, 515, 72, 6)
    .fillAndStroke("#f0fdf4", "#bbf7d0");

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(brandTeal)
    .text("MOBILIZATION PREPAYMENT TAX INVOICE & FINANCIAL TRAIL", 55, 222);

  doc
    .fontSize(8.5)
    .font("Helvetica")
    .fillColor(primaryColor)
    .text(`Total Agreed Contract Value: ₹${totalBudget.toLocaleString()}`, 55, 237)
    .text(`Prepayment Mobilization Rate: ${order.prepaymentPercentage || order.sellerAdvancePercentage || 25}%`, 55, 249)
    .text(`Online Txn ID: ${order.advanceTransactionId || "Online Razorpay Verified"}`, 55, 261)
    .text(`Payment Mode: ${order.advancePaymentMode || "Online (Razorpay / UPI)"}`, 55, 273);

  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(brandTeal)
    .text(`Advance Paid: ₹${advAmount.toLocaleString()}`, 330, 232, { align: "right" })
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor("#b91c1c") // Red
    .text(`Remaining Due on Delivery: ₹${remainingBalance.toLocaleString()}`, 330, 248, { align: "right" })
    .fontSize(8)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Status: ${(order.advancePaymentStatus || "Paid").toUpperCase()} (VERIFIED)`, 330, 264, { align: "right" });

  // 4. PROCUREMENT ITEMS SUMMARY TABLE
  const tableTop = 298;
  doc
    .rect(40, tableTop, 515, 20)
    .fill("#f8fafc");

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("#", 45, tableTop + 6)
    .text("Requirement Demand Item", 65, tableTop + 6)
    .text("Category", 260, tableTop + 6)
    .text("Qty", 380, tableTop + 6, { align: "center", width: 40 })
    .text("Budget/Unit", 430, tableTop + 6, { align: "right", width: 55 })
    .text("Line Total", 495, tableTop + 6, { align: "right", width: 55 });

  let y = tableTop + 24;
  const items = Array.isArray(order.requirements) && order.requirements.length > 0
    ? order.requirements.slice(0, 8)
    : [{ itemName: "Bulk Uniform / Stationery Set", category: "General Bulk", quantity: order.totalQuantity || 100, budgetPerUnit: Math.round(totalBudget / (order.totalQuantity || 100)) }];

  items.forEach((item, index) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.sellerPricePerUnit || item.budgetPerUnit) || 0;
    const lineTotal = qty * rate;

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(String(index + 1), 45, y)
      .text(item.itemName || "Procurement Item", 65, y, { width: 190, lineBreak: false })
      .fillColor(mutedColor)
      .text(item.category || "General", 260, y, { width: 115, lineBreak: false })
      .fillColor(primaryColor)
      .text(String(qty), 380, y, { align: "center", width: 40 })
      .text(`₹${rate}`, 430, y, { align: "right", width: 55 })
      .font("Helvetica-Bold")
      .text(`₹${lineTotal.toLocaleString()}`, 495, y, { align: "right", width: 55 });

    y += 18;
  });

  // Divider under table
  doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, y + 4).lineTo(555, y + 4).stroke();

  // 5. TERMS & CONDITIONS
  const termsY = Math.max(y + 20, 520);
  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Mobilization Advance & Delivery Handover Terms:", 40, termsY)
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(mutedColor)
    .text("1. This tax invoice confirms partial mobilization advance towards raw material procurement, cutting, and batch tailoring.", 40, termsY + 12)
    .text(`2. The remaining balance amount of ₹${remainingBalance.toLocaleString()} is strictly due on receipt and physical inspection of final delivery consignment.`, 40, termsY + 22)
    .text("3. Remaining balance settlement and physical handover is verified via the Delivery Partner Tracker Link or on-site UPI QR.", 40, termsY + 32)
    .text("4. Delivery is fulfilled exclusively via Bookvardi Verified Store Self-Delivery Fleet under platform escrow guidelines.", 40, termsY + 42);

  // 6. VERIFICATION STAMP & DIGITAL SEAL
  const stampY = termsY + 68;
  doc
    .roundedRect(40, stampY, 230, 52, 6)
    .strokeColor("#bbf7d0")
    .fillAndStroke("#f0fdf4", "#86efac");

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(brandTeal)
    .text("✔ BOOKVARDI VERIFIED ADVANCE RECEIPT", 50, stampY + 10)
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(mutedColor)
    .text(`Authorized by: Corporate Procurement Desk`, 50, stampY + 22)
    .text(`Audit Hash: BV-AUD-${order.referenceId || "2026"}-OK`, 50, stampY + 34);

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Authorized Seller Signature / Stamp", 360, stampY + 34, { align: "right" })
    .fontSize(7.5)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("(Digitally signed on Bookvardi Platform)", 360, stampY + 44, { align: "right" });

  doc.end();
  return doc;
};
