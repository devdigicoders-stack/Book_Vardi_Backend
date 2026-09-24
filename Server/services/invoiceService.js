import PDFDocument from "pdfkit";

/**
 * Generate a professional Flipkart / Amazon style GST Tax Invoice PDF
 * @param {Object} order - Order object from MongoDB (populated with product & seller)
 * @param {Object} [filterSellerId] - Optional seller ID if generated from a specific seller's portal
 * @returns {PDFDocument} - Streaming PDF document
 */
export const generateTaxInvoicePDF = (order, filterSellerId = null) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  const primaryColor = "#0f172a"; // Slate 900
  const accentColor = "#2563eb"; // Blue 600
  const mutedColor = "#64748b"; // Slate 500
  const borderColor = "#e2e8f0"; // Slate 200

  // 1. HEADER SECTION (Brand & Invoice Title)
  doc
    .fillColor(accentColor)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("SchoolKart", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("India's Premier School & Education Marketplace", 40, 68)
    .text("GSTIN: 09AAACS1429B1Z2 | support@schoolkart.com", 40, 80);

  doc
    .fillColor(primaryColor)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("TAX INVOICE", 400, 40, { align: "right" })
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Invoice No: INV-${order.orderId || order._id.toString().substring(0, 8).toUpperCase()}`, 400, 62, { align: "right" })
    .text(`Order ID: ${order.orderId || order._id}`, 400, 74, { align: "right" })
    .text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 400, 86, { align: "right" });

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 105).lineTo(555, 105).stroke();

  // 2. SOLD BY (SELLER) & BILL TO / SHIP TO SECTION
  const sellerInfo = order.items && order.items[0]?.sellerId ? order.items[0].sellerId : null;
  const sellerName = sellerInfo?.storeName || sellerInfo?.name || "SchoolKart Verified Seller Hub";
  const sellerPhone = sellerInfo?.phone || "Support Helpline";
  const sellerCity = sellerInfo?.city || "India";

  // Left Column: Sold By
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Sold By / Seller:", 40, 118)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(mutedColor)
    .text(sellerName, 40, 132)
    .text(`Location: ${sellerCity}`, 40, 144)
    .text(`Helpline: ${sellerPhone}`, 40, 156)
    .text("GST Category: Regular Taxpayer", 40, 168);

  // Right Column: Customer Shipping Address
  const customerName = order.customer?.name || "Valued Customer";
  const customerPhone = order.customer?.phone || "";
  const customerEmail = order.customer?.email || "";
  const address = order.shippingAddress || {};
  const street = address.street || order.address || "Delivery Address";
  const cityState = `${address.city || ""} ${address.state || ""} ${address.pincode || ""}`.trim();

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Billing & Delivery Address:", 320, 118)
    .font("Helvetica")
    .fontSize(9)
    .fillColor(mutedColor)
    .text(customerName, 320, 132)
    .text(street, 320, 144, { width: 235 })
    .text(cityState || "India", 320, 156)
    .text(`Phone: ${customerPhone} ${customerEmail ? "| " + customerEmail : ""}`, 320, 168, { width: 235 });

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 195).lineTo(555, 195).stroke();

  // 3. PAYMENT & ORDER META DETAILS
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(`Payment Mode: `, 40, 205, { continued: true })
    .font("Helvetica")
    .fillColor(accentColor)
    .text(`${order.paymentMethod || "Online / COD"} (${(order.paymentStatus || "pending").toUpperCase()})`, { continued: true })
    .fillColor(primaryColor)
    .font("Helvetica-Bold")
    .text(`    Order Status: `, { continued: true })
    .font("Helvetica")
    .fillColor(accentColor)
    .text((order.overallStatus || "processing").toUpperCase());

  if (order.razorpayPaymentId) {
    doc.fontSize(8).fillColor(mutedColor).text(`Razorpay Payment ID: ${order.razorpayPaymentId}`, 40, 220);
  }

  // 4. ITEMS TABLE HEADER
  const tableTop = order.razorpayPaymentId ? 240 : 230;
  
  // Table Header Background
  doc.rect(40, tableTop, 515, 22).fill("#f1f5f9");

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("#", 45, tableTop + 6)
    .text("Item Description", 65, tableTop + 6)
    .text("Size / Age", 250, tableTop + 6)
    .text("Qty", 345, tableTop + 6, { align: "center" })
    .text("Unit Price", 390, tableTop + 6, { align: "right" })
    .text("Total (INR)", 480, tableTop + 6, { align: "right" });

  // 5. ITEMS ROWS
  let itemsToRender = order.items || [];
  if (filterSellerId) {
    itemsToRender = itemsToRender.filter(
      (item) => item.sellerId && item.sellerId._id?.toString() === filterSellerId.toString()
    );
  }

  // Helper to determine Product-level GST Rate (High Priority)
  const getProductGstRate = (item) => {
    const explicitGst = item.gstPercent ?? item.gstPercentage ?? item.gstRate ?? item.gst ?? item.taxRate ?? item.productId?.gstPercent ?? item.productId?.gstRate ?? item.productId?.gst ?? item.productId?.gstPercentage ?? item.productId?.taxRate;
    if (explicitGst !== undefined && explicitGst !== null && !isNaN(Number(explicitGst))) {
      return Number(explicitGst);
    }
    const category = (item.category || item.productId?.category || '').toLowerCase();
    if (category.includes('book')) return 0;
    if (category.includes('uniform') || category.includes('clothing')) return 5;
    if (category.includes('shoe')) return 12;
    return 18;
  };

  let y = tableTop + 26;
  let subtotal = 0;
  let totalTaxableValue = 0;
  let totalTaxAmount = 0;

  itemsToRender.forEach((item, index) => {
    const itemTotal = (item.finalPrice || item.price || 0) * (item.quantity || 1);
    subtotal += itemTotal;
    const gstRate = getProductGstRate(item);

    if (gstRate > 0) {
      const itemTaxable = itemTotal / (1 + gstRate / 100);
      const itemTax = itemTotal - itemTaxable;
      totalTaxableValue += itemTaxable;
      totalTaxAmount += itemTax;
    } else {
      totalTaxableValue += itemTotal;
    }

    const variantDetails = [
      item.size ? `Size: ${item.size}` : "",
      item.age ? `Age: ${item.age}` : "",
      `GST: ${gstRate}%`
    ]
      .filter(Boolean)
      .join(", ") || "Standard";

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(`${index + 1}`, 45, y)
      .text(item.name || "Product Item", 65, y, { width: 180 })
      .fillColor(mutedColor)
      .text(variantDetails, 250, y, { width: 90 })
      .fillColor(primaryColor)
      .text(`${item.quantity || 1}`, 345, y, { align: "center" })
      .text(`₹${(item.finalPrice || item.price || 0).toLocaleString("en-IN")}`, 390, y, { align: "right" })
      .font("Helvetica-Bold")
      .text(`₹${itemTotal.toLocaleString("en-IN")}`, 480, y, { align: "right" });

    y += 24;

    // Row separator
    doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(40, y - 4).lineTo(555, y - 4).stroke();
  });

  // 6. TOTALS CALCULATION & GST BREAKDOWN
  y += 10;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 10;

  const taxableValue = Math.round(totalTaxableValue * 100) / 100;
  const totalTax = Math.round(totalTaxAmount * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = cgst;

  // Tax Breakdown (Left)
  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("GST Tax Breakdown (Product Priority):", 45, y)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Taxable Amount: ₹${taxableValue.toLocaleString("en-IN")}`, 45, y + 14)
    .text(`CGST (Split): ₹${cgst.toLocaleString("en-IN")}`, 45, y + 26)
    .text(`SGST (Split): ₹${sgst.toLocaleString("en-IN")}`, 45, y + 38)
    .text(`Total Tax: ₹${totalTax.toLocaleString("en-IN")}`, 45, y + 50);

  // Financial Summary (Right)
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Subtotal:", 380, y, { align: "right" })
    .text(`₹${subtotal.toLocaleString("en-IN")}`, 480, y, { align: "right" })
    .text("Delivery Charges:", 380, y + 16, { align: "right" })
    .text("FREE", 480, y + 16, { align: "right" });

  // Grand Total Banner
  y += 36;
  doc.rect(360, y, 195, 26).fill("#e0f2fe"); // Light sky blue
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Grand Total:", 370, y + 7)
    .text(`₹${subtotal.toLocaleString("en-IN")}`, 480, y + 7, { align: "right" });

  // 7. FOOTER & DECLARATION
  const footerY = 730;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Declaration & Terms:", 40, footerY + 10)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("1. This is a computer generated invoice and does not require physical signature.", 40, footerY + 22)
    .text("2. All disputes are subject to local judicial jurisdiction.", 40, footerY + 32)
    .text("3. Returns / exchanges are subject to the SchoolKart standard 7-day school exchange policy.", 40, footerY + 42)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Thank you for choosing SchoolKart for your child's educational journey!", 40, footerY + 56, { align: "center" });

  doc.end();
  return doc;
};
