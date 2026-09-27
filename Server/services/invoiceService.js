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

  // Helper to determine Product-level GST Rate set by seller
  const getProductGstRate = (item) => {
    const explicitGst = item.gstPercent ?? item.gstPercentage ?? item.gstRate ?? item.gst ?? item.taxRate ?? item.productId?.gstPercent ?? item.productId?.gstRate ?? item.productId?.gst ?? item.productId?.gstPercentage ?? item.productId?.taxRate;
    if (explicitGst !== undefined && explicitGst !== null && String(explicitGst).trim() !== '' && !isNaN(Number(explicitGst))) {
      return Number(explicitGst);
    }
    return 5;
  };

  let y = tableTop + 26;
  let subtotal = 0;
  let totalTaxableValue = 0;
  let totalTaxAmount = 0;

  // Helper to resolve seller name per product item
  const getItemSellerName = (item) => {
    if (item.sellerId && typeof item.sellerId === "object") {
      const sName = item.sellerId.storeName || item.sellerId.name || item.sellerId.sellerName || item.sellerId.legalName;
      if (sName) return sName;
    }
    if (item.sellerName) return item.sellerName;
    if (item.storeName) return item.storeName;
    if (item.seller) return typeof item.seller === "string" ? item.seller : (item.seller.storeName || item.seller.name);
    return sellerName;
  };

  itemsToRender.forEach((item, index) => {
    const itemTotal = (item.finalPrice || item.price || 0) * (item.quantity || 1);
    subtotal += itemTotal;
    const gstRate = getProductGstRate(item);
    let itemTax = 0;

    if (gstRate > 0) {
      const itemTaxable = itemTotal / (1 + gstRate / 100);
      itemTax = itemTotal - itemTaxable;
      totalTaxableValue += itemTaxable;
      totalTaxAmount += itemTax;
    } else {
      totalTaxableValue += itemTotal;
    }

    const itemSeller = getItemSellerName(item);
    const itemDescText = `${item.name || "Product Item"}\nSold by: ${itemSeller}`;
    const variantDetails = [
      item.size ? `Size: ${item.size}` : "",
      item.age ? `Age: ${item.age}` : "",
      `GST: ${gstRate}% (₹${itemTax.toFixed(2)})`
    ]
      .filter(Boolean)
      .join("\n");

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(`${index + 1}`, 45, y)
      .text(itemDescText, 65, y, { width: 175 })
      .fillColor(mutedColor)
      .fontSize(8)
      .text(variantDetails, 250, y, { width: 95 })
      .fillColor(primaryColor)
      .fontSize(9)
      .text(`${item.quantity || 1}`, 345, y, { align: "center" })
      .text(`₹${(item.finalPrice || item.price || 0).toLocaleString("en-IN")}`, 390, y, { align: "right" })
      .font("Helvetica-Bold")
      .text(`₹${itemTotal.toLocaleString("en-IN")}`, 480, y, { align: "right" });

    y += 32;

    // Row separator
    doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(40, y - 4).lineTo(555, y - 4).stroke();
  });

  // 6. TOTALS CALCULATION & GST BREAKDOWN
  y += 10;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 10;

  // Zero-Hardcode Dynamic State Parser
  const parseStateKeyFromText = (text) => {
    if (!text) return '';
    const str = String(text).toLowerCase();
    const states = [
      { key: 'uttarpradesh', aliases: ['uttar pradesh', 'uttarpradesh', 'up', 'noida', 'lucknow', 'kanpur', 'ghaziabad', 'agra', 'varanasi', 'prayagraj'] },
      { key: 'delhi', aliases: ['delhi', 'new delhi', 'nct of delhi', 'nct', 'dl'] },
      { key: 'maharashtra', aliases: ['maharashtra', 'mumbai', 'pune', 'nagpur', 'thane', 'mh'] },
      { key: 'karnataka', aliases: ['karnataka', 'bangalore', 'bengaluru', 'mysore', 'ka'] },
      { key: 'tamilnadu', aliases: ['tamil nadu', 'tamilnadu', 'chennai', 'coimbatore', 'tn'] },
      { key: 'haryana', aliases: ['haryana', 'gurugram', 'gurgaon', 'faridabad', 'hr'] },
      { key: 'rajasthan', aliases: ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'rj'] },
      { key: 'westbengal', aliases: ['west bengal', 'westbengal', 'kolkata', 'wb'] },
      { key: 'gujarat', aliases: ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'gj'] },
      { key: 'punjab', aliases: ['punjab', 'ludhiana', 'amritsar', 'pb'] },
      { key: 'madhyapradesh', aliases: ['madhya pradesh', 'madhyapradesh', 'bhopal', 'indore', 'mp'] },
      { key: 'bihar', aliases: ['bihar', 'patna', 'br'] },
      { key: 'telangana', aliases: ['telangana', 'hyderabad', 'tg', 'ts'] },
      { key: 'andhrapradesh', aliases: ['andhra pradesh', 'andhrapradesh', 'visakhapatnam', 'ap'] },
      { key: 'kerala', aliases: ['kerala', 'kochi', 'thiruvananthapuram', 'kl'] },
      { key: 'uttarakhand', aliases: ['uttarakhand', 'dehradun', 'uk'] }
    ];

    for (const st of states) {
      for (const alias of st.aliases) {
        if (new RegExp(`\\b${alias}\\b`, 'i').test(str)) {
          return st.key;
        }
      }
    }
    return str.trim();
  };

  const getDynamicState = (obj, fallbackText) => {
    if (obj && typeof obj === 'object') {
      if (obj.state && String(obj.state).trim()) return parseStateKeyFromText(obj.state);
      const combined = `${obj.street || ''} ${obj.addressLine || ''} ${obj.city || ''} ${obj.address || ''}`;
      if (combined.trim()) return parseStateKeyFromText(combined);
    }
    return parseStateKeyFromText(fallbackText || '');
  };

  const sellerStateKey = getDynamicState(sellerInfo, `${sellerInfo?.city || ''} ${sellerInfo?.address || ''}`);
  const customerStateKey = getDynamicState(address, `${street} ${cityState}`);

  const isSameState = !sellerStateKey || !customerStateKey || sellerStateKey === customerStateKey;
  const sellerStateStr = sellerInfo?.state || sellerInfo?.city || sellerStateKey || "Seller Location";
  const customerStateStr = address?.state || address?.city || customerStateKey || "Customer Location";

  const taxableValue = Math.round(totalTaxableValue * 100) / 100;
  const totalTax = Math.round(totalTaxAmount * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = cgst;

  // Tax Breakdown (Left)
  if (isSameState) {
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("GST Tax Breakdown (Intra-State):", 45, y)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text(`Taxable Amount: ₹${taxableValue.toLocaleString("en-IN")}`, 45, y + 14)
      .text(`CGST (Central 50%): ₹${cgst.toLocaleString("en-IN")}`, 45, y + 26)
      .text(`SGST (State 50%): ₹${sgst.toLocaleString("en-IN")}`, 45, y + 38)
      .text(`Total Tax Collected: ₹${totalTax.toLocaleString("en-IN")}`, 45, y + 50);
  } else {
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("GST Tax Breakdown (Inter-State):", 45, y)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text(`Taxable Amount: ₹${taxableValue.toLocaleString("en-IN")}`, 45, y + 14)
      .text(`IGST (Integrated 100%): ₹${totalTax.toLocaleString("en-IN")}`, 45, y + 26)
      .text(`Supply: ${sellerStateStr} -> ${customerStateStr}`, 45, y + 38)
      .text(`Total Tax Collected: ₹${totalTax.toLocaleString("en-IN")}`, 45, y + 50);
  }

  // Financial Summary (Right)
  const shippingCost = Number(order.shippingFee ?? order.shippingCost ?? order.shippingCharges ?? 0);
  const discountAmount = Number(order.discount ?? order.discountAmount ?? 0);
  const calculatedGrandTotal = Number(order.total || order.totalAmount || (subtotal + shippingCost - discountAmount));

  let rightY = y;
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Subtotal:", 350, rightY, { align: "right", width: 120 })
    .text(`₹${subtotal.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  rightY += 14;
  if (discountAmount > 0) {
    doc
      .text("Offer / Coupon:", 350, rightY, { align: "right", width: 120 })
      .fillColor("#047857") // Emerald green
      .text(`-₹${discountAmount.toLocaleString("en-IN")}`, 480, rightY, { align: "right" })
      .fillColor(mutedColor);
  } else {
    doc
      .text("Offer / Coupon:", 350, rightY, { align: "right", width: 120 })
      .text("Not Applied (₹0.00)", 480, rightY, { align: "right" });
  }

  rightY += 14;
  doc
    .text("Delivery Charges:", 350, rightY, { align: "right", width: 120 })
    .text(shippingCost === 0 ? "Not Applied (FREE)" : `₹${shippingCost.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  // Grand Total Banner
  y += 45;
  doc.rect(360, y, 195, 26).fill("#e0f2fe"); // Light sky blue
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Grand Total:", 370, y + 7)
    .text(`₹${calculatedGrandTotal.toLocaleString("en-IN")}`, 480, y + 7, { align: "right" });

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
