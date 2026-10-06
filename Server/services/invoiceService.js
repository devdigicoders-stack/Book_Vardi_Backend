import PDFDocument from "pdfkit";

export const isGenericSellerPlaceholder = (val) => {
  if (!val || typeof val !== 'string') return true;
  const s = val.trim().toLowerCase();
  return (
    s === '' ||
    s === 'bookvardi verified seller hub' ||
    s === 'bookvardi verified seller' ||
    s === 'bookvardimerchant' ||
    s === 'bookvardi merchant' ||
    s === 'book vardi partner merchant' ||
    s === 'book vardi partner store' ||
    s === 'partner merchant' ||
    s === 'unknown seller' ||
    s === 'new merchant' ||
    s === 'merchant store' ||
    s === 'direct marketplace' ||
    s === 'n/a'
  );
};

export const isGenericCustomerPlaceholder = (val) => {
  if (!val || typeof val !== 'string') return true;
  const s = val.trim().toLowerCase();
  return (
    s === '' ||
    s === 'student' ||
    s === 'student customer' ||
    s === 'test student' ||
    s === 'avatar upload tester' ||
    s === 'customer' ||
    s === 'valued customer' ||
    s === 'verified customer' ||
    s === 'user' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'n/a'
  );
};

export const isUnstitchedProduct = (item) => {
  if (!item) return false;
  const candStr = [
    item.category,
    item.subCategory,
    item.name,
    item.productName,
    item.itemName,
    item.description,
    item.productId?.category,
    item.productId?.subCategory,
    item.productId?.name,
    item.productId?.description
  ].filter(Boolean).join(' ').toLowerCase();

  return Boolean(
    item.isMeterBased ||
    item.unit === 'meter' ||
    item.unit === 'm' ||
    item.unit === 'mtr' ||
    item.productId?.isMeterBased ||
    item.productId?.unit === 'meter' ||
    item.productId?.unit === 'm' ||
    candStr.includes('unstitched') ||
    candStr.includes('unstiched')
  );
};

export const formatInvoiceQuantity = (item) => {
  const rawQty = Number(item?.quantity ?? item?.qty ?? 1);
  if (isNaN(rawQty)) return '1';
  
  if (isUnstitchedProduct(item)) {
    return rawQty.toFixed(2);
  }
  
  return rawQty % 1 === 0 ? String(rawQty) : rawQty.toFixed(2);
};

export const resolveInvoiceSellerDetails = (order, filterSellerId = null) => {
  const items = order.items || [];
  let targetItem = items.find(it => {
    if (filterSellerId) {
      const sId = it.sellerId?._id?.toString() || it.sellerId?.toString();
      return sId === filterSellerId.toString();
    }
    const cand = it.sellerDetails?.storeName || it.sellerDetails?.sellerName || it.sellerName || it.storeName;
    return cand && !isGenericSellerPlaceholder(cand);
  }) || items[0] || {};

  const sObj = (targetItem.sellerId && typeof targetItem.sellerId === 'object') ? targetItem.sellerId : null;
  const sDetails = targetItem.sellerDetails || order.sellerDetails || {};

  const storeCandidate = 
    (sObj && !isGenericSellerPlaceholder(sObj.storeName) && sObj.storeName) ||
    (sObj && !isGenericSellerPlaceholder(sObj.name) && sObj.name) ||
    (sDetails && !isGenericSellerPlaceholder(sDetails.storeName) && sDetails.storeName) ||
    (sDetails && !isGenericSellerPlaceholder(sDetails.sellerName) && sDetails.sellerName) ||
    (!isGenericSellerPlaceholder(targetItem.sellerName) && targetItem.sellerName) ||
    (!isGenericSellerPlaceholder(targetItem.storeName) && targetItem.storeName) ||
    (!isGenericSellerPlaceholder(targetItem.sellerStoreName) && targetItem.sellerStoreName) ||
    (!isGenericSellerPlaceholder(order.sellerStoreName) && order.sellerStoreName) ||
    (!isGenericSellerPlaceholder(order.sellerName) && order.sellerName) ||
    sObj?.storeName ||
    sObj?.name ||
    sDetails.storeName ||
    sDetails.sellerName ||
    targetItem.sellerName ||
    targetItem.storeName ||
    order.sellerStoreName ||
    order.sellerName ||
    "BookVardi Verified Seller";

  const ownerCandidate = sObj?.name || sObj?.ownerFullName || sDetails.sellerName || sDetails.name || "";
  const phoneCandidate = sObj?.phone || sDetails.phone || targetItem.sellerPhone || order.sellerPhone || "";
  const emailCandidate = sObj?.email || sDetails.email || targetItem.sellerEmail || order.sellerEmail || "";
  const addressCandidate = sObj?.address || sObj?.addressLine || sDetails.address || targetItem.sellerAddress || order.sellerAddress || "";
  const cityCandidate = sObj?.city || sDetails.city || targetItem.sellerCity || order.sellerCity || "";
  const stateCandidate = sObj?.state || sDetails.state || targetItem.sellerState || order.sellerState || "";
  const pincodeCandidate = sObj?.pincode || sDetails.pincode || "";
  const gstCandidate = sObj?.gstNumber || sDetails.gstNumber || order.gstNumber || "";

  return {
    storeName: storeCandidate,
    ownerName: ownerCandidate,
    phone: phoneCandidate,
    email: emailCandidate,
    address: addressCandidate,
    city: cityCandidate,
    state: stateCandidate,
    pincode: pincodeCandidate,
    gstNumber: gstCandidate
  };
};

export const resolveInvoiceConsumerDetails = (order) => {
  const addr = (typeof order.shippingAddress === 'object' && order.shippingAddress !== null)
    ? order.shippingAddress
    : {};

  // 1. Consumer Phone & Email first
  const phoneFromAddr = addr.phone || addr.mobile || addr.contactPhone;
  const phoneFromCust = typeof order.customer === 'object' ? order.customer?.phone : (typeof order.customerPhone === 'string' ? order.customerPhone : '');
  const phoneFromUser = (order.userId && typeof order.userId === 'object') ? order.userId.phone : (order.userPhone || order.phone);
  const resolvedPhone = phoneFromAddr || phoneFromCust || phoneFromUser || "";

  const emailFromCust = typeof order.customer === 'object' ? order.customer?.email : (typeof order.customerEmail === 'string' ? order.customerEmail : '');
  const emailFromAddr = addr.email;
  const emailFromUser = (order.userId && typeof order.userId === 'object') ? order.userId.email : (order.userEmail || order.email);
  const resolvedEmail = emailFromCust || emailFromAddr || emailFromUser || "";

  // 2. Consumer Name
  const candidateNames = [
    addr.name,
    addr.fullName,
    addr.recipientName,
    addr.contactPerson,
    typeof order.customer === 'object' ? order.customer?.name : null,
    typeof order.customerName === 'string' ? order.customerName : null,
    (order.userId && typeof order.userId === 'object') ? (order.userId.name || order.userId.fullName) : null,
    order.userName,
    order.user?.name
  ].filter(n => n && !isGenericCustomerPlaceholder(n));

  const resolvedName = candidateNames[0] || (resolvedPhone ? `Verified Consumer (${resolvedPhone.slice(-4)})` : "Verified Consumer");

  // 3. Consumer Address
  let street = "";
  let cityStatePin = "";

  if (typeof order.shippingAddress === 'string' && order.shippingAddress.trim() && !order.shippingAddress.toLowerCase().includes('customer address') && !order.shippingAddress.toLowerCase().includes('customer delivery address')) {
    street = order.shippingAddress.trim();
  } else if (typeof order.address === 'string' && order.address.trim() && !order.address.toLowerCase().includes('customer address') && !order.address.toLowerCase().includes('customer delivery address')) {
    street = order.address.trim();
  } else {
    const line1 = [
      addr.houseNumber || addr.flat || addr.flatNo,
      addr.addressLine || addr.addressLine1 || addr.street || addr.address,
      addr.colony || addr.landmark || addr.area
    ].filter(Boolean).join(', ');

    street = line1 || (addr.city ? `${addr.city}, ${addr.state || ''}`.trim() : "Verified Delivery Location");
    cityStatePin = [
      addr.city,
      addr.state,
      addr.pincode ? `PIN: ${addr.pincode}` : ''
    ].filter(Boolean).join(', ');
  }

  return {
    name: resolvedName,
    phone: resolvedPhone,
    email: resolvedEmail,
    street,
    cityStatePin: cityStatePin || (addr.city || addr.state ? `${addr.city || ''} ${addr.state || ''}`.trim() : "India")
  };
};

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
    .text("BookVardi", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("India's Premier School & Education Marketplace", 40, 68)
    .text("GSTIN: 09AAACS1429B1Z2 | support@bookvardi.com", 40, 80);

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
    .text(`Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, 400, 86, { align: "right" });

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 105).lineTo(555, 105).stroke();

  // 2. SOLD BY (SELLER) & BILL TO / SHIP TO SECTION
  const resolvedSeller = resolveInvoiceSellerDetails(order, filterSellerId);
  const resolvedConsumer = resolveInvoiceConsumerDetails(order);

  // Left Column: Sold By
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Sold By / Seller:", 40, 118)
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedSeller.storeName, 40, 132, { width: 260 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor);

  let sY = 145;
  if (resolvedSeller.ownerName && resolvedSeller.ownerName !== resolvedSeller.storeName) {
    doc.text(`Contact: ${resolvedSeller.ownerName}`, 40, sY, { width: 260 });
    sY += 12;
  }
  const sellerLocStr = [resolvedSeller.address, resolvedSeller.city, resolvedSeller.state, resolvedSeller.pincode].filter(Boolean).join(", ");
  doc.text(sellerLocStr ? `Address: ${sellerLocStr}` : "Location: India", 40, sY, { width: 260 });
  sY += 12;

  const sellerContactStr = [
    resolvedSeller.email ? `Email: ${resolvedSeller.email}` : null
  ].filter(Boolean).join(" | ");
  if (sellerContactStr) {
    doc.text(sellerContactStr, 40, sY, { width: 260 });
    sY += 12;
  }
  doc.text(resolvedSeller.gstNumber ? `GSTIN: ${resolvedSeller.gstNumber}` : "GSTIN: 09AAACB1234F1Z9 (Regular Taxpayer)", 40, sY, { width: 260 });

  // Right Column: Customer Shipping Address
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Billing & Delivery Address:", 320, 118)
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedConsumer.name, 320, 132, { width: 235 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor)
    .text(resolvedConsumer.street, 320, 145, { width: 235 })
    .text(resolvedConsumer.cityStatePin, 320, 157, { width: 235 });

  const consumerContactStr = [
    resolvedConsumer.phone ? `Phone: ${resolvedConsumer.phone}` : null,
    resolvedConsumer.email ? `Email: ${resolvedConsumer.email}` : null
  ].filter(Boolean).join(" | ");
  if (consumerContactStr) {
    doc.text(consumerContactStr, 320, 169, { width: 235 });
  }

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

  // Logistics tracking gating: strictly visible when Out for Delivery & partner decided
  const normStatus = String(order.overallStatus || order.status || "").toLowerCase().replace(/_/g, " ");
  const isOut = normStatus === "out for delivery" || normStatus === "delivered";
  const isSelf = String(order.deliveryMode || order.deliveryType || "").toLowerCase().includes("self") || Boolean(order.selfDeliveryDetails?.deliveryPartnerToken || order.selfDeliveryDetails?.deliveryPersonName);
  const isThirdParty = String(order.deliveryMode || order.deliveryType || "").toLowerCase().includes("third") || Boolean(order.courierName || order.thirdPartyDetails?.courierName);
  const hasPartner = isSelf || isThirdParty || Boolean(order.courierName || order.selfDeliveryDetails?.deliveryPersonName);
  const hasTracking = isOut && hasPartner && Boolean(order.trackingNumber || order.selfDeliveryDetails?.deliveryPartnerToken || order.thirdPartyDetails?.trackingNumber);

  const deliveryPartnerDisplay = isSelf 
    ? (order.selfDeliveryDetails?.deliveryPersonName ? `Direct Self-Delivery (Rider: ${order.selfDeliveryDetails.deliveryPersonName})` : "Direct Self-Delivery (Store Fleet)")
    : (order.courierName || order.thirdPartyDetails?.courierName || "3rd-Party Logistics Carrier");

  const trackingNumberDisplay = order.trackingNumber || (isSelf ? order.selfDeliveryDetails?.deliveryPartnerToken : order.thirdPartyDetails?.trackingNumber) || "";
  const trackingLinkDisplay = order.trackingUrl || order.selfDeliveryDetails?.trackingUrl || order.thirdPartyDetails?.trackingUrl || "";

  let trackingOffset = 0;
  const trackingLineY = 220 + (order.razorpayPaymentId ? 14 : 0);
  if (hasTracking) {
    trackingOffset = 18;
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#047857")
      .text(`Dispatch & Delivery: `, 40, trackingLineY, { continued: true })
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(`${deliveryPartnerDisplay} | Tracking ID: `, { continued: true })
      .font("Helvetica-Bold")
      .text(trackingNumberDisplay || "Not Assigned", { continued: trackingLinkDisplay ? true : false });
    if (trackingLinkDisplay) {
      doc
        .font("Helvetica")
        .fillColor(accentColor)
        .text(` | URL: ${trackingLinkDisplay}`);
    }
  } else {
    trackingOffset = 14;
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text(`Logistics Status: ${isOut ? "Out for Delivery (Awaiting Partner Assignment)" : "Awaiting Dispatch"} | Tracking ID: Not Assigned`, 40, trackingLineY);
  }

  // 4. ITEMS TABLE HEADER
  const tableTop = (order.razorpayPaymentId ? 235 : 220) + trackingOffset + 6;
  
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
      if (sName && !isGenericSellerPlaceholder(sName)) return sName;
    }
    if (item.sellerDetails && typeof item.sellerDetails === "object") {
      const sName = item.sellerDetails.storeName || item.sellerDetails.sellerName;
      if (sName && !isGenericSellerPlaceholder(sName)) return sName;
    }
    if (item.sellerName && !isGenericSellerPlaceholder(item.sellerName)) return item.sellerName;
    if (item.storeName && !isGenericSellerPlaceholder(item.storeName)) return item.storeName;
    if (item.seller) {
      const sName = typeof item.seller === "string" ? item.seller : (item.seller.storeName || item.seller.name);
      if (sName && !isGenericSellerPlaceholder(sName)) return sName;
    }
    return resolvedSeller.storeName || "BookVardi Verified Seller";
  };

  itemsToRender.forEach((item, index) => {
    const rawQty = Number(item.quantity || 1);
    const itemTotal = (item.finalPrice || item.price || 0) * rawQty;
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

    const displayQty = formatInvoiceQuantity(item);

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
      .text(displayQty, 345, y, { align: "center" })
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

  const sellerStateKey = getDynamicState(resolvedSeller, `${resolvedSeller?.state || ''} ${resolvedSeller?.city || ''} ${resolvedSeller?.address || ''}`);
  const customerStateKey = getDynamicState(order.shippingAddress, `${resolvedConsumer?.street || ''} ${resolvedConsumer?.cityStatePin || ''}`);

  const isSameState = !sellerStateKey || !customerStateKey || sellerStateKey === customerStateKey;
  const sellerStateStr = resolvedSeller?.state || resolvedSeller?.city || sellerStateKey || "Seller Location";
  const customerStateStr = order.shippingAddress?.state || order.shippingAddress?.city || customerStateKey || "Customer Location";

  const taxableValue = Math.round(totalTaxableValue * 100) / 100;
  const totalTax = Math.round(totalTaxAmount * 100) / 100;
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = cgst;

  // Tax Breakdown (Left)
  if (totalTax > 0) {
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
  } else {
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(primaryColor)
      .text("Tax Classification:", 45, y)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text("Retail Consumer Invoice", 45, y + 14)
      .text("All item prices are inclusive of all applicable taxes.", 45, y + 26)
      .text("Zero additional tax levied at checkout.", 45, y + 38);
  }

  // Financial Summary (Right)
  const shippingCost = Number(order.shippingFee ?? order.shippingCost ?? order.shippingCharges ?? 0);
  const discountAmount = Number(order.discount ?? order.discountAmount ?? 0);
  const pointsDiscount = Number(order.pointsDiscount ?? order.pointsDiscountAmount ?? 0);
  const calculatedGrandTotal = Number(order.total || order.totalAmount || (subtotal + shippingCost - discountAmount - pointsDiscount));

  let rightY = y;
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Subtotal (GST Included):", 310, rightY, { align: "right", width: 160 })
    .text(`₹${subtotal.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  rightY += 14;
  if (discountAmount > 0) {
    doc
      .text("Offer / Coupon:", 350, rightY, { align: "right", width: 120 })
      .fillColor("#047857") // Emerald green
      .text(`-₹${discountAmount.toLocaleString("en-IN")}`, 480, rightY, { align: "right" })
      .fillColor(mutedColor);
  }

  if (pointsDiscount > 0) {
    rightY += 14;
    doc
      .text("Reward Points:", 350, rightY, { align: "right", width: 120 })
      .fillColor("#047857")
      .text(`-₹${pointsDiscount.toLocaleString("en-IN")}`, 480, rightY, { align: "right" })
      .fillColor(mutedColor);
  }

  rightY += 14;
  doc
    .text("Delivery Charges (Incl. 18% GST):", 310, rightY, { align: "right", width: 160 })
    .text(shippingCost === 0 ? "FREE" : `₹${shippingCost.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  // Grand Total Banner
  const bannerY = Math.max(y + 55, rightY + 16);
  doc.rect(360, bannerY, 195, 26).fill("#e0f2fe"); // Light sky blue
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Grand Total (Incl. Taxes):", 365, bannerY + 7)
    .text(`₹${calculatedGrandTotal.toLocaleString("en-IN")}`, 480, bannerY + 7, { align: "right" });

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
    .text("3. Returns / exchanges are subject to the BookVardi standard 7-day school exchange policy.", 40, footerY + 42)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Authorized Signatory", 380, footerY + 10, { align: "right" })
    .fillColor(primaryColor)
    .text(resolvedSeller.storeName, 380, footerY + 22, { align: "right" })
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`GSTIN: ${resolvedSeller.gstNumber || 'Exempt / N/A'}`, 380, footerY + 32, { align: "right" })
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("Thank you for choosing BookVardi for your child's educational journey!", 40, footerY + 56, { align: "center" });

  doc.end();
  return doc;
};

/**
 * Generate a professional GST Credit Note PDF for cancelled orders
 * @param {Object} order - Order object from MongoDB
 * @param {Object} [filterSellerId] - Optional seller ID
 * @returns {PDFDocument} - Streaming PDF document
 */
export const generateCreditNotePDF = (order, filterSellerId = null) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  const primaryColor = "#0f172a"; // Slate 900
  const roseColor = "#be123c"; // Rose 700
  const mutedColor = "#64748b"; // Slate 500
  const borderColor = "#e2e8f0"; // Slate 200

  const orderIdStr = order.orderId || (order._id ? order._id.toString().substring(0, 8).toUpperCase() : "ORDER");
  const creditNoteNo = `CN-${orderIdStr}`;
  const originalInvoiceNo = `INV-${orderIdStr}`;
  const cancelDateStr = new Date(order.cancelledAt || order.updatedAt || order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  // 1. HEADER SECTION (Brand & Credit Note Title)
  doc
    .fillColor(roseColor)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("BookVardi", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("India's Premier School & Education Marketplace", 40, 68)
    .text("GSTIN: 09AAACS1429B1Z2 | support@bookvardi.com", 40, 80);

  doc
    .fillColor(roseColor)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text("CREDIT NOTE", 400, 40, { align: "right" })
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Credit Note No: ${creditNoteNo}`, 400, 62, { align: "right" })
    .text(`Original Invoice Ref: ${originalInvoiceNo}`, 400, 74, { align: "right" })
    .text(`Date of Reversal: ${cancelDateStr}`, 400, 86, { align: "right" });

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 105).lineTo(555, 105).stroke();

  // 2. SELLER & CUSTOMER SECTION
  const resolvedSeller = resolveInvoiceSellerDetails(order, filterSellerId);
  const resolvedConsumer = resolveInvoiceConsumerDetails(order);

  // Left Column: Issued By
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Issued By (Seller):", 40, 118)
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedSeller.storeName, 40, 132, { width: 260 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor);

  let cnSY = 145;
  if (resolvedSeller.ownerName && resolvedSeller.ownerName !== resolvedSeller.storeName) {
    doc.text(`Contact: ${resolvedSeller.ownerName}`, 40, cnSY, { width: 260 });
    cnSY += 12;
  }
  const cnLocStr = [resolvedSeller.address, resolvedSeller.city, resolvedSeller.state, resolvedSeller.pincode].filter(Boolean).join(", ");
  doc.text(cnLocStr ? `Address: ${cnLocStr}` : "Location: India", 40, cnSY, { width: 260 });
  cnSY += 12;

  const cnSellerContactStr = [
    resolvedSeller.email ? `Email: ${resolvedSeller.email}` : null
  ].filter(Boolean).join(" | ");
  if (cnSellerContactStr) {
    doc.text(cnSellerContactStr, 40, cnSY, { width: 260 });
    cnSY += 12;
  }
  doc.text(resolvedSeller.gstNumber ? `GSTIN: ${resolvedSeller.gstNumber}` : "GSTIN: 09AAACB1234F1Z9 (Regular Taxpayer)", 40, cnSY, { width: 260 });

  // Right Column: Customer Details
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Issued To (Customer):", 320, 118)
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedConsumer.name, 320, 132, { width: 235 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor)
    .text(resolvedConsumer.street, 320, 145, { width: 235 })
    .text(resolvedConsumer.cityStatePin, 320, 157, { width: 235 });

  const cnCustContactStr = [
    resolvedConsumer.phone ? `Phone: ${resolvedConsumer.phone}` : null,
    resolvedConsumer.email ? `Email: ${resolvedConsumer.email}` : null
  ].filter(Boolean).join(" | ");
  if (cnCustContactStr) {
    doc.text(cnCustContactStr, 320, 169, { width: 235 });
  }

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 195).lineTo(555, 195).stroke();

  // 3. CANCELLATION META BOX
  doc.rect(40, 205, 515, 30).fill("#fff1f2"); // Light rose background
  const cancelReason = order.cancellationReason || order.cancelReason || order.reason || "Order Cancellation Requested by Customer";

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(roseColor)
    .text("Status: ORDER CANCELLED & REFUND CREDITED", 50, 212)
    .font("Helvetica")
    .fillColor(primaryColor)
    .text(`Reason: ${cancelReason}`, 50, 223, { width: 495 });

  // 4. ITEMS TABLE HEADER
  const tableTop = 248;
  doc.rect(40, tableTop, 515, 22).fill("#f1f5f9");

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("#", 45, tableTop + 6)
    .text("Cancelled Item Description", 65, tableTop + 6)
    .text("Size / Age", 250, tableTop + 6)
    .text("Qty", 345, tableTop + 6, { align: "center" })
    .text("Unit Price", 390, tableTop + 6, { align: "right" })
    .text("Refunded (INR)", 470, tableTop + 6, { align: "right" });

  let itemsToRender = order.items || [];
  if (filterSellerId) {
    itemsToRender = itemsToRender.filter(
      (item) => item.sellerId && item.sellerId._id?.toString() === filterSellerId.toString()
    );
  }

  let y = tableTop + 26;
  let subtotal = 0;

  itemsToRender.forEach((item, index) => {
    const rawQty = Number(item.quantity || 1);
    const itemTotal = (item.finalPrice || item.price || 0) * rawQty;
    subtotal += itemTotal;

    const variantDetails = [
      item.size ? `Size: ${item.size}` : "",
      item.age ? `Age: ${item.age}` : "",
      "Reversal: 100%"
    ]
      .filter(Boolean)
      .join("\n");

    const itemSeller = item.sellerName || item.storeName || (item.sellerDetails && (item.sellerDetails.storeName || item.sellerDetails.sellerName)) || (item.sellerId && (item.sellerId.storeName || item.sellerId.name)) || resolvedSeller.storeName;

    const displayQty = formatInvoiceQuantity(item);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(`${index + 1}`, 45, y)
      .text(`${item.name || "Product Item"}\nSold by: ${itemSeller}`, 65, y, { width: 175 })
      .fillColor(mutedColor)
      .fontSize(8)
      .text(variantDetails, 250, y, { width: 95 })
      .fillColor(primaryColor)
      .fontSize(9)
      .text(displayQty, 345, y, { align: "center" })
      .text(`₹${(item.finalPrice || item.price || 0).toLocaleString("en-IN")}`, 390, y, { align: "right" })
      .font("Helvetica-Bold")
      .fillColor(roseColor)
      .text(`-₹${itemTotal.toLocaleString("en-IN")}`, 470, y, { align: "right" });

    y += 32;
    doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(40, y - 4).lineTo(555, y - 4).stroke();
  });

  // 5. TOTALS CALCULATION
  y += 10;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 10;

  const shippingCost = Number(order.shippingFee ?? order.shippingCost ?? order.shippingCharges ?? 0);
  const discountAmount = Number(order.discount ?? order.discountAmount ?? 0);
  const pointsDiscount = Number(order.pointsDiscount ?? order.pointsDiscountAmount ?? 0);
  const totalRefundAmount = Number(order.total || order.totalAmount || (subtotal + shippingCost - discountAmount - pointsDiscount));

  // Statutory Reversal Notice (Left)
  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("GST Statutory Compliance Notice:", 45, y)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Credit Note issued under Section 34 of CGST Act, 2017.", 45, y + 14)
    .text("Original supply tax liability reversed in full.", 45, y + 26)
    .text(`Refund Mode: ${order.paymentMethod || "Online Refund"}`, 45, y + 38)
    .text(`Refund Status: Completed / Processing`, 45, y + 50);

  // Financial Refund Summary (Right)
  let rightY = y;
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Subtotal Reversal:", 350, rightY, { align: "right", width: 120 })
    .text(`₹${subtotal.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  if (discountAmount > 0) {
    rightY += 14;
    doc
      .text("Coupon Reversal:", 350, rightY, { align: "right", width: 120 })
      .text(`-₹${discountAmount.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });
  }

  if (pointsDiscount > 0) {
    rightY += 14;
    doc
      .text("Reward Points Restored:", 350, rightY, { align: "right", width: 120 })
      .text(`+₹${pointsDiscount.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });
  }

  rightY += 14;
  doc
    .text("Delivery Adjustment (Incl. 18% GST):", 310, rightY, { align: "right", width: 160 })
    .text(shippingCost === 0 ? "FREE" : `₹${shippingCost.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  // Net Refunded Banner
  const bannerY = Math.max(y + 60, rightY + 20);
  doc.rect(340, bannerY, 215, 28).fill("#fff1f2"); // Rose light
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(roseColor)
    .text("Net Refunded Amount:", 350, bannerY + 8)
    .text(`₹${totalRefundAmount.toLocaleString("en-IN")}`, 480, bannerY + 8, { align: "right" });

  // 6. FOOTER
  const footerY = 730;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Terms & Conditions:", 40, footerY + 10)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("1. This Credit Note certifies full cancellation and refund authorization for the specified order.", 40, footerY + 22)
    .text("2. The refunded amount has been processed to the customer's original payment method or wallet.", 40, footerY + 32)
    .font("Helvetica-Bold")
    .fillColor(roseColor)
    .text("Authorized Signatory", 380, footerY + 10, { align: "right" })
    .fillColor(primaryColor)
    .text(resolvedSeller.storeName, 380, footerY + 22, { align: "right" })
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`GSTIN: ${resolvedSeller.gstNumber || 'Exempt / N/A'}`, 380, footerY + 32, { align: "right" })
    .font("Helvetica-Bold")
    .fillColor(roseColor)
    .text("BookVardi Customer Support Helpline: support@bookvardi.com", 40, footerY + 50, { align: "center" });

  doc.end();
  return doc;
};

/**
 * Generate a professional GST Exchange Tax Invoice & Replacement Slip PDF
 * @param {Object} order - Order object from MongoDB
 * @param {Object} [filterSellerId] - Optional seller ID
 * @returns {PDFDocument} - Streaming PDF document
 */
export const generateExchangeInvoicePDF = (order, filterSellerId = null) => {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  const primaryColor = "#0f172a"; // Slate 900
  const tealColor = "#0d9488"; // Teal 600
  const mutedColor = "#64748b"; // Slate 500
  const borderColor = "#e2e8f0"; // Slate 200

  const orderIdStr = order.orderId || (order._id ? order._id.toString().substring(0, 8).toUpperCase() : "ORDER");
  const exchangeInvoiceNo = `EXCH-${orderIdStr}`;
  const originalInvoiceNo = `INV-${orderIdStr}`;
  const exchangeDateStr = new Date(order.returnRequest?.updatedAt || order.updatedAt || order.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  // 1. HEADER SECTION (Brand & Exchange Invoice Title)
  doc
    .fillColor(tealColor)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("BookVardi", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("India's Premier School & Education Marketplace", 40, 68)
    .text("GSTIN: 09AAACS1429B1Z2 | support@bookvardi.com", 40, 80);

  doc
    .fillColor(tealColor)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text("EXCHANGE TAX INVOICE", 380, 40, { align: "right" })
    .fontSize(8.5)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Exchange Ref: ${exchangeInvoiceNo}`, 380, 60, { align: "right" })
    .text(`Original Invoice Ref: ${originalInvoiceNo}`, 380, 72, { align: "right" })
    .text(`Date of Exchange: ${exchangeDateStr}`, 380, 84, { align: "right" });

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 102).lineTo(555, 102).stroke();

  // 2. SELLER & CUSTOMER SECTION
  const resolvedSeller = resolveInvoiceSellerDetails(order, filterSellerId);
  const resolvedConsumer = resolveInvoiceConsumerDetails(order);

  // Left Column: Sold By
  doc
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Sold By / Exchange Merchant:", 40, 112)
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedSeller.storeName, 40, 125, { width: 260 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor);

  let exSY = 138;
  if (resolvedSeller.ownerName && resolvedSeller.ownerName !== resolvedSeller.storeName) {
    doc.text(`Contact: ${resolvedSeller.ownerName}`, 40, exSY, { width: 260 });
    exSY += 12;
  }
  const exLocStr = [resolvedSeller.address, resolvedSeller.city, resolvedSeller.state, resolvedSeller.pincode].filter(Boolean).join(", ");
  doc.text(exLocStr ? `Address: ${exLocStr}` : "Location: India", 40, exSY, { width: 260 });
  exSY += 12;

  const exSellerContactStr = [
    resolvedSeller.phone ? `Helpline: ${resolvedSeller.phone}` : null,
    resolvedSeller.email ? `Email: ${resolvedSeller.email}` : null
  ].filter(Boolean).join(" | ");
  if (exSellerContactStr) {
    doc.text(exSellerContactStr, 40, exSY, { width: 260 });
    exSY += 12;
  }
  doc.text(resolvedSeller.gstNumber ? `GSTIN: ${resolvedSeller.gstNumber}` : "GST Category: Regular Taxpayer", 40, exSY, { width: 260 });

  // Right Column: Customer Details
  doc
    .fontSize(9.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Issued To (Customer):", 320, 112)
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(resolvedConsumer.name, 320, 125, { width: 235 })
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(mutedColor)
    .text(resolvedConsumer.street, 320, 138, { width: 235 })
    .text(resolvedConsumer.cityStatePin, 320, 150, { width: 235 });

  const exCustContactStr = [
    resolvedConsumer.phone ? `Phone: ${resolvedConsumer.phone}` : null,
    resolvedConsumer.email ? `Email: ${resolvedConsumer.email}` : null
  ].filter(Boolean).join(" | ");
  if (exCustContactStr) {
    doc.text(exCustContactStr, 320, 162, { width: 235 });
  }

  // Divider Line
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 182).lineTo(555, 182).stroke();

  // 3. EXCHANGE SUMMARY BOX
  doc.rect(40, 190, 515, 34).fill("#ccfbf1"); // Light teal background
  const exchangeReason = order.returnRequest?.reason || "Size / Variant Replacement Request";
  const targetSize = order.returnRequest?.exchangeSize || "Requested Size Variant";
  const awbStr = order.returnRequest?.exchangeAwb ? `AWB: ${order.returnRequest.exchangeAwb} (${order.returnRequest.exchangeCourier || "Express Logistics"})` : "Dispatched via Express Logistics Fleet";

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("PRODUCT EXCHANGE CONFIRMED & REPLACEMENT DISPATCHED", 50, 196)
    .font("Helvetica")
    .fillColor(primaryColor)
    .text(`Reason: ${exchangeReason} | Replacement Variant: Size ${targetSize} | ${awbStr}`, 50, 208, { width: 495 });

  // 4. RETURNED ITEM VS REPLACEMENT ITEM TABLE
  const tableTop = 232;

  // Section 4A: Item Returned
  doc.rect(40, tableTop, 515, 20).fill("#f1f5f9");
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("1. Item Returned by Customer", 45, tableTop + 5)
    .text("Qty", 345, tableTop + 5, { align: "center" })
    .text("Original Value", 450, tableTop + 5, { align: "right" });

  let y = tableTop + 24;
  let itemsToRender = order.items || [];
  if (filterSellerId) {
    itemsToRender = itemsToRender.filter(
      (item) => item.sellerId && item.sellerId._id?.toString() === filterSellerId.toString()
    );
  }

  let totalReturnedVal = 0;
  itemsToRender.forEach((item, index) => {
    const rawQty = Number(item.quantity || 1);
    const itemTotal = (item.finalPrice || item.price || 0) * rawQty;
    totalReturnedVal += itemTotal;
    const displayQty = formatInvoiceQuantity(item);

    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(`${index + 1}. ${item.name || "Product Item"} (Original Size: ${item.size || "Standard"})`, 45, y, { width: 280 })
      .text(displayQty, 345, y, { align: "center" })
      .font("Helvetica-Bold")
      .text(`₹${itemTotal.toLocaleString("en-IN")}`, 450, y, { align: "right" });

    y += 18;
  });

  // Section 4B: Replacement Item Issued
  y += 6;
  doc.rect(40, y, 515, 20).fill("#e0f2fe"); // Sky light
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("2. Replacement Item Issued & Delivered", 45, y + 5)
    .text("Qty", 345, y + 5, { align: "center" })
    .text("New Invoice Value", 450, y + 5, { align: "right" });

  y += 24;
  itemsToRender.forEach((item, index) => {
    const rawQty = Number(item.quantity || 1);
    const itemTotal = (item.finalPrice || item.price || 0) * rawQty;
    const displayQty = formatInvoiceQuantity(item);

    doc
      .fontSize(8.5)
      .font("Helvetica-Bold")
      .fillColor(tealColor)
      .text(`${index + 1}. ${item.name || "Product Item"} (New Replacement Size: ${targetSize})`, 45, y, { width: 280 })
      .font("Helvetica")
      .fillColor(primaryColor)
      .text(displayQty, 345, y, { align: "center" })
      .font("Helvetica-Bold")
      .text(`₹${itemTotal.toLocaleString("en-IN")}`, 450, y, { align: "right" });

    y += 18;
  });

  // 5. SETTLEMENT & TAX ADJUSTMENT SUMMARY
  y += 10;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 10;

  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Exchange Tax & Price Adjustment Summary:", 45, y)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("1. Equal Value Exchange — Original GST liability transferred to replacement unit.", 45, y + 14)
    .text("2. Zero additional price difference payable by customer.", 45, y + 26)
    .text(`3. Replacement AWB: ${order.returnRequest?.exchangeAwb || "Hand Delivered"}`, 45, y + 38);

  let rightY = y;
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Returned Item Credit:", 330, rightY, { align: "right", width: 140 })
    .text(`-₹${totalReturnedVal.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  rightY += 14;
  doc
    .text("Replacement Item Value:", 330, rightY, { align: "right", width: 140 })
    .text(`+₹${totalReturnedVal.toLocaleString("en-IN")}`, 480, rightY, { align: "right" });

  rightY += 14;
  doc
    .text("Doorstep Exchange Fee:", 330, rightY, { align: "right", width: 140 })
    .text("FREE", 480, rightY, { align: "right" });

  // Net Balance Payable Banner
  const bannerY = Math.max(y + 54, rightY + 18);
  doc.rect(340, bannerY, 215, 26).fill("#ccfbf1");
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("Net Balance Payable:", 350, bannerY + 7)
    .text("₹0.00 (Fully Settled)", 460, bannerY + 7, { align: "right" });

  // 6. FOOTER
  const footerY = 730;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Terms & Conditions:", 40, footerY + 10)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("1. This Exchange Tax Invoice serves as the official proof of replacement delivery under BookVardi policy.", 40, footerY + 22)
    .text("2. Replaced items are subject to statutory warranty and school uniform replacement guidelines.", 40, footerY + 32)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("BookVardi Customer Support Helpline: support@bookvardi.com", 40, footerY + 50, { align: "center" });

  doc.end();
  return doc;
};

/**
 * Generate a comprehensive Seller Financial Statement & Settlement PDF
 * @param {Object} seller - Seller object from MongoDB
 * @param {Array} orders - Array of enriched orders belonging to this seller
 * @param {Object} metrics - Computed financial aggregates (GMV, platform cut, GST, COD vs UPI totals)
 * @returns {PDFDocument} - Streaming PDF document
 */
export const generateSellerFinancialStatementPDF = (seller, orders = [], metrics = {}) => {
  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });

  const primaryColor = "#0f172a"; // Slate 900
  const tealColor = "#0f766e"; // Teal 700
  const accentColor = "#0369a1"; // Sky 700
  const mutedColor = "#64748b"; // Slate 500
  const borderColor = "#cbd5e1"; // Slate 300
  const lightBg = "#f8fafc"; // Slate 50
  const greenColor = "#047857"; // Emerald 700
  const amberColor = "#b45309"; // Amber 700

  const storeName = seller.storeName || seller.businessName || seller.name || "Vendor Store";
  const legalName = seller.legalBusinessName || seller.ownerDetails?.ownerFullName || seller.name || storeName;
  const ownerName = seller.ownerDetails?.ownerFullName || seller.ownerName || seller.name || "N/A";
  const gstin = seller.gstNumber || seller.gstin || "Unregistered / Exempt";
  const pan = seller.documents?.panNumber || seller.ownerDetails?.ownerPan || seller.pan || "N/A";
  const phone = seller.phone || seller.ownerPhone || "N/A";
  const email = seller.email || "N/A";
  const address = seller.address ? `${seller.address}, ${seller.city || ''} ${seller.state || ''} ${seller.pincode || ''}`.trim() : "Address on File";

  const bank = seller.bankDetails || {};
  const bankName = bank.bankName || bank.bank || "Linked Bank";
  const acctNum = bank.accountNumber || bank.account || "N/A";
  const ifsc = bank.ifscCode || bank.ifsc || "N/A";
  const acctHolder = bank.accountHolderName || bank.holderName || ownerName;
  const acctType = bank.accountType || "Current / Savings Account";

  const statementId = `STMT-${String(seller._id || seller.id || 'SELLER').slice(-6).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const statementDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const totalGMV = Number(metrics.grossSales || 0);
  const commissionRate = Number(metrics.commissionRate || seller.commissionRate || seller.commissionPercentage || 5);
  const platformCut = Number(metrics.platformCut || 0);
  const netEarnings = Number(metrics.netEarnings || (totalGMV - platformCut));
  const totalGst = Number(metrics.totalGst || 0);
  const codVolume = Number(metrics.codVolume || 0);
  const codCount = Number(metrics.codCount || 0);
  const upiVolume = Number(metrics.upiVolume || 0);
  const upiCount = Number(metrics.upiCount || 0);
  const payableBalance = Number(metrics.payableBalance ?? seller.walletBalance ?? 0);
  const settledVolume = Number(metrics.settledVolume ?? seller.totalWithdrawn ?? 0);

  // 1. HEADER SECTION
  doc
    .fillColor(tealColor)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text("BookVardi", 40, 40)
    .fontSize(9)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("India's Premier School & Education Marketplace", 40, 68)
    .text("BookVardi Private Limited | GSTIN: 09AAACB1234F1Z9", 40, 80)
    .text("Support: finance@bookvardi.in | Helpline: +91 94500 00000", 40, 92);

  doc
    .fillColor(primaryColor)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("SELLER FINANCIAL STATEMENT", 320, 40, { align: "right" })
    .fontSize(8.5)
    .font("Helvetica")
    .fillColor(mutedColor)
    .text(`Statement Ref: ${statementId}`, 320, 60, { align: "right" })
    .text(`Statement Date: ${statementDate}`, 320, 72, { align: "right" })
    .text(`Reporting Period: Complete Historical Settlement`, 320, 84, { align: "right" })
    .text(`Commission Model: Standard Platform Cut (${commissionRate}%)`, 320, 96, { align: "right" });

  // Divider
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 112).lineTo(555, 112).stroke();

  // 2. SELLER DOSSIER & BANK SETTLEMENT INFO (2 columns)
  // Left: Seller Business Information
  doc
    .rect(40, 120, 250, 95)
    .fillAndStroke(lightBg, borderColor);

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("MERCHANT PROFILE & REGISTRATION", 50, 128)
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primaryColor)
    .text(storeName, 50, 142)
    .font("Helvetica")
    .fontSize(8)
    .fillColor(mutedColor)
    .text(`Entity: ${legalName}`, 50, 156, { width: 230 })
    .text(`Proprietor: ${ownerName} | Mobile: ${phone}`, 50, 168, { width: 230 })
    .text(`GSTIN: ${gstin} | PAN: ${pan}`, 50, 180, { width: 230 })
    .text(`Address: ${address.slice(0, 50)}${address.length > 50 ? '...' : ''}`, 50, 192, { width: 230 });

  // Right: Bank Disbursal Account Details
  doc
    .rect(305, 120, 250, 95)
    .fillAndStroke(lightBg, borderColor);

  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor(accentColor)
    .text("SETTLEMENT BANK ACCOUNT (DISBURSAL)", 315, 128)
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(primaryColor)
    .text(bankName, 315, 142)
    .font("Helvetica")
    .fontSize(8)
    .fillColor(mutedColor)
    .text(`Account Holder: ${acctHolder}`, 315, 156, { width: 230 })
    .text(`Account Number: ${acctNum !== 'N/A' ? acctNum : 'Pending Verification'}`, 315, 168, { width: 230 })
    .text(`IFSC Code: ${ifsc} (${acctType})`, 315, 180, { width: 230 })
    .text("Payout Mechanism: Automated IMPS / NEFT Transfer", 315, 192, { width: 230 });

  // 3. EXECUTIVE FINANCIAL METRICS SUMMARY BOX (4 mini boxes)
  const boxTop = 225;
  const boxW = 122;
  const boxH = 48;

  // Box 1: Gross Sales
  doc.rect(40, boxTop, boxW, boxH).fillAndStroke("#f0fdf4", "#bbf7d0");
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(greenColor).text("GROSS MERCHANDISE (GMV)", 46, boxTop + 6);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(primaryColor).text(`₹${totalGMV.toLocaleString("en-IN")}`, 46, boxTop + 18);
  doc.fontSize(7).font("Helvetica").fillColor(mutedColor).text(`${orders.length} Total Orders`, 46, boxTop + 34);

  // Box 2: Platform Cut
  doc.rect(170, boxTop, boxW, boxH).fillAndStroke("#fffbeb", "#fde68a");
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(amberColor).text(`PLATFORM COMMISSION (${commissionRate}%)`, 176, boxTop + 6);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(amberColor).text(`₹${platformCut.toLocaleString("en-IN")}`, 176, boxTop + 18);
  doc.fontSize(7).font("Helvetica").fillColor(mutedColor).text(`Standard marketplace fee`, 176, boxTop + 34);

  // Box 3: Net Seller Earnings
  doc.rect(300, boxTop, boxW, boxH).fillAndStroke("#f0fdfa", "#99f6e4");
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(tealColor).text("NET SELLER REVENUE", 306, boxTop + 6);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(tealColor).text(`₹${netEarnings.toLocaleString("en-IN")}`, 306, boxTop + 18);
  doc.fontSize(7).font("Helvetica").fillColor(mutedColor).text("Net after platform fee", 306, boxTop + 34);

  // Box 4: Current Payable Balance
  doc.rect(430, boxTop, boxW, boxH).fillAndStroke("#f8fafc", borderColor);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(accentColor).text("CURRENT PAYABLE BALANCE", 436, boxTop + 6);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(primaryColor).text(`₹${payableBalance.toLocaleString("en-IN")}`, 436, boxTop + 18);
  doc.fontSize(7).font("Helvetica").fillColor(mutedColor).text(`Settled: ₹${settledVolume.toLocaleString("en-IN")}`, 436, boxTop + 34);

  // 4. PAYMENT METHOD SPLIT (COD vs UPI) & GST SUMMARY BAR
  const splitTop = 282;
  doc.rect(40, splitTop, 515, 26).fillAndStroke(lightBg, borderColor);

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("PAYMENT METHOD RECONCILIATION:", 48, splitTop + 9)
    .font("Helvetica")
    .fillColor(greenColor)
    .text(`UPI / Online: ₹${upiVolume.toLocaleString("en-IN")} (${upiCount} orders)`, 215, splitTop + 9)
    .fillColor(amberColor)
    .text(`COD (Cash on Delivery): ₹${codVolume.toLocaleString("en-IN")} (${codCount} orders)`, 335, splitTop + 9)
    .fillColor(primaryColor)
    .text(`GST Component: ₹${totalGst.toLocaleString("en-IN")}`, 470, splitTop + 9);

  // 5. ITEMIZED ORDERS SETTLEMENT LEDGER TABLE
  let y = 320;
  const printTableHeader = (topY) => {
    doc.rect(40, topY, 515, 18).fill("#0f766e");
    doc
      .fontSize(7.5)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text("Order ID", 45, topY + 5)
      .text("Date", 100, topY + 5)
      .text("Customer & Details", 155, topY + 5)
      .text("Method", 255, topY + 5)
      .text("Gross Sale", 335, topY + 5, { align: "right" })
      .text("Plat. Cut", 390, topY + 5, { align: "right" })
      .text("GST (5%)", 445, topY + 5, { align: "right" })
      .text("Net Share", 505, topY + 5, { align: "right" });
  };

  printTableHeader(y);
  y += 20;

  if (orders.length === 0) {
    doc
      .fontSize(8.5)
      .font("Helvetica")
      .fillColor(mutedColor)
      .text("No orders recorded for this merchant in the database.", 40, y + 10, { align: "center", width: 515 });
    y += 30;
  } else {
    orders.forEach((o, idx) => {
      // Check page break threshold
      if (y > 730) {
        doc.addPage();
        y = 40;
        printTableHeader(y);
        y += 20;
      }

      const ordId = o.orderId || o.id || `ORD-${idx + 1}`;
      const ordDate = o.date || (o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "N/A");
      const custName = (o.customerName || o.customer?.name || "Consumer").slice(0, 18);
      const isCod = String(o.paymentMethod || "").toUpperCase().includes("COD");
      const methodLabel = isCod ? "COD" : "UPI / Online";

      const orderGross = Number(o.sellerSubtotal ?? o.total ?? o.totalAmount ?? 0);
      const ordRate = Number(o.commissionRate || commissionRate);
      const ordCut = Math.round(orderGross * (ordRate / 100) * 100) / 100;
      const ordGst = Math.round((orderGross - (orderGross / 1.05)) * 100) / 100;
      const ordNet = Math.max(0, Math.round((orderGross - ordCut) * 100) / 100);

      // Row background zebra striping
      if (idx % 2 === 1) {
        doc.rect(40, y - 2, 515, 16).fill("#f8fafc");
      }

      doc
        .fontSize(7.5)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(ordId, 45, y)
        .font("Helvetica")
        .fillColor(mutedColor)
        .text(ordDate, 100, y)
        .fillColor(primaryColor)
        .text(custName, 155, y)
        .fillColor(isCod ? amberColor : greenColor)
        .font("Helvetica-Bold")
        .text(methodLabel, 255, y)
        .font("Helvetica")
        .fillColor(primaryColor)
        .text(`₹${orderGross.toLocaleString("en-IN")}`, 335, y, { align: "right" })
        .fillColor(amberColor)
        .text(`-₹${ordCut.toFixed(2)}`, 390, y, { align: "right" })
        .fillColor(mutedColor)
        .text(`₹${ordGst.toFixed(2)}`, 445, y, { align: "right" })
        .font("Helvetica-Bold")
        .fillColor(greenColor)
        .text(`₹${ordNet.toLocaleString("en-IN")}`, 505, y, { align: "right" });

      y += 16;
    });
  }

  // 6. TOTALS RECAP BAR
  if (y > 700) {
    doc.addPage();
    y = 40;
  }

  y += 6;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 8;

  doc.rect(40, y, 515, 24).fill("#f0fdfa");
  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("TOTAL ACCUMULATED LEDGER:", 48, y + 8)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text(`GMV: ₹${totalGMV.toLocaleString("en-IN")}`, 240, y + 8)
    .fillColor(amberColor)
    .text(`Fees: -₹${platformCut.toLocaleString("en-IN")}`, 360, y + 8)
    .fillColor(greenColor)
    .text(`Net: ₹${netEarnings.toLocaleString("en-IN")}`, 470, y + 8);

  y += 34;

  // 7. DECLARATION & AUDIT FOOTER
  if (y > 690) {
    doc.addPage();
    y = 40;
  }

  doc.strokeColor(borderColor).lineWidth(0.8).moveTo(40, y).lineTo(555, y).stroke();
  y += 10;

  doc
    .fontSize(7.5)
    .font("Helvetica-Bold")
    .fillColor(primaryColor)
    .text("Statutory Declaration & Disbursal Policies:", 40, y)
    .font("Helvetica")
    .fontSize(7)
    .fillColor(mutedColor)
    .text("1. This financial statement is an official computer-generated statement issued by BookVardi Private Limited.", 40, y + 10)
    .text("2. Net payable balance is scheduled for electronic transfer to the verified vendor bank account via NEFT / IMPS.", 40, y + 18)
    .text("3. Product GST is calculated based on statutory rates (5% on educational attire & textbooks). Platform fee includes 18% GST.", 40, y + 26)
    .text("4. Reconciliation discrepancies must be submitted to vendor accounts desk within 7 working days.", 40, y + 34)
    .font("Helvetica-Bold")
    .fillColor(tealColor)
    .text("BookVardi Accounts & Settlement Bureau", 400, y + 10, { align: "right" })
    .font("Helvetica")
    .fillColor(mutedColor)
    .text("Corporate Finance Desk, Lucknow (UP)", 400, y + 20, { align: "right" })
    .text("Digitally Authenticated", 400, y + 30, { align: "right" });

  doc.end();
  return doc;
};


