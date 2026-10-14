/**
 * BookVardi Seller Settlement Rules Engine
 * 
 * Rule 1: Online Payment + Self Delivery (ऑनलाइन भुगतान + सेलर की डिलीवरी)
 * - Gross Sale: ग्राहक से प्राप्त कुल बिक्री राशि (item net customer purchase price)
 * - Portal Commission: 10% — पोर्टल का कमीशन
 * - GST on Commission: 18% — कमीशन पर GST
 * - TDS: 0.1% — लागू TDS की कटौती (Sec 194-O)
 * - GST TCS: 0.5% — जहाँ GST कानून के अनुसार लागू हो (Sec 52)
 * - Final Seller Settlement: सभी लागू कटौतियों के बाद बची राशि सेलर को दी जाएगी
 * 
 * Rule 2: Online Payment + Third-Party Delivery (ऑनलाइन भुगतान + कूरियर से डिलीवरी)
 * - Gross Sale: ग्राहक से प्राप्त कुल बिक्री राशि
 * - Portal Commission: 10% — पोर्टल का कमीशन
 * - GST on Commission: 18% — कमीशन पर GST
 * - TDS: 0.1% — लागू TDS की कटौती
 * - GST TCS: 0.5% — जहाँ GST कानून के अनुसार लागू हो
 * - Delivery Charges + 18% GST: डिलीवरी का खर्च और उस पर GST तभी काटें, जब यह खर्च सेलर के जिम्मे हो
 * - Final Seller Settlement: सभी लागू कटौतियों के बाद बची राशि सेलर को दी जाएगी
 * - ₹400 से अधिक के ऑर्डर पर: यदि डिलीवरी का खर्च एडमिन उठाता है, तो सेलर से डिलीवरी चार्ज और उसका GST नहीं काटना है
 * 
 * Rule 3: COD + Self Delivery (कैश भुगतान + सेलर की डिलीवरी)
 * - ग्राहक पूरा पैसा सीधे सेलर को देगा।
 * - पोर्टल सेलर को बिक्री की राशि ट्रांसफर नहीं करेगा।
 * - Portal Commission: 10% — सेलर से पोर्टल का कमीशन लिया जाएगा।
 * - GST on Commission: 18% — कमीशन पर GST लिया जाएगा।
 * - TDS: 0.1% — लागू TDS की राशि सेलर से वसूल की जाएगी (Sec 194-O)।
 * - GST TCS: 0% — जब पोर्टल ग्राहक का भुगतान एकत्र नहीं करता, तो GST TCS नहीं काटना है (Sec 52 E-Commerce TCS is 0%)।
 * - Final Settlement: कमीशन, कमीशन पर GST और लागू TDS की कुल राशि सेलर को पोर्टल में जमा करनी होगी या उसके अगले भुगतान से समायोजित की जाएगी। इस स्थिति में सेलर का सेटलमेंट माइनस (-) में दिखेगा।
 * 
 * Rule 4: COD + Third-Party Delivery (कैश भुगतान + कूरियर से डिलीवरी)
 * यदि कूरियर ग्राहक से कैश लेकर पोर्टल को भुगतान करता है:
 * - Gross Sale: ग्राहक से प्राप्त कुल बिक्री राशि।
 * - Portal Commission: 10% — पोर्टल का कमीशन।
 * - GST on Commission: 18% — कमीशन पर GST।
 * - TDS: 0.1% — लागू TDS की कटौती।
 * - GST TCS: 0.5% — जहाँ GST कानून के अनुसार लागू हो।
 * - Delivery Charges + 18% GST: डिलीवरी का खर्च और उस पर GST तभी काटें, जब यह खर्च सेलर के जिम्मे हो।
 * - Final Seller Settlement: सभी लागू कटौतियों के बाद बची राशि सेलर को दी जाएगी।
 * - ₹400 से अधिक के ऑर्डर पर: यदि डिलीवरी का खर्च एडमिन उठाता है, तो सेलर से डिलीवरी चार्ज और उसका GST नहीं काटना है।
 */

export const SETTLEMENT_RULES = {
  ONLINE_SELF_DELIVERY: {
    code: "ONLINE_SELF_DELIVERY",
    ruleNumber: 1,
    name: "Online Payment + Self Delivery",
    nameHi: "ऑनलाइन भुगतान + सेलर की डिलीवरी",
    defaultCommissionRate: 10, // 10%
    gstOnCommissionRate: 18,    // 18%
    tdsRate: 0.1,              // 0.1%
    gstTcsRate: 0.5            // 0.5%
  },
  ONLINE_THIRD_PARTY_DELIVERY: {
    code: "ONLINE_THIRD_PARTY_DELIVERY",
    ruleNumber: 2,
    name: "Online Payment + Third-Party Delivery",
    nameHi: "ऑनलाइन भुगतान + कूरियर से डिलीवरी",
    defaultCommissionRate: 10, // 10%
    gstOnCommissionRate: 18,    // 18%
    tdsRate: 0.1,              // 0.1%
    gstTcsRate: 0.5,           // 0.5%
    gstOnDeliveryRate: 18,     // 18% GST on delivery
    freeDeliveryThreshold: 400  // Orders > ₹400 have delivery charges absorbed by Admin
  },
  COD_SELF_DELIVERY: {
    code: "COD_SELF_DELIVERY",
    ruleNumber: 3,
    name: "COD + Self Delivery",
    nameHi: "कैश भुगतान + सेलर की डिलीवरी",
    defaultCommissionRate: 10, // 10%
    gstOnCommissionRate: 18,    // 18%
    tdsRate: 0.1,              // 0.1%
    gstTcsRate: 0.0,           // 0% (जब पोर्टल ग्राहक का भुगतान एकत्र नहीं करता)
    isSellerCollectedCash: true
  },
  COD_THIRD_PARTY_DELIVERY: {
    code: "COD_THIRD_PARTY_DELIVERY",
    ruleNumber: 4,
    name: "COD + Third-Party Delivery",
    nameHi: "कैश भुगतान + कूरियर से डिलीवरी",
    defaultCommissionRate: 10, // 10%
    gstOnCommissionRate: 18,    // 18%
    tdsRate: 0.1,              // 0.1%
    gstTcsRate: 0.5,           // 0.5% (लागू कानून के अनुसार जब कूरियर पोर्टल को भुगतान करता है)
    gstOnDeliveryRate: 18,     // 18% GST on delivery
    freeDeliveryThreshold: 400, // Orders > ₹400 have delivery charges absorbed by Admin
    isSellerCollectedCash: false // Courier remits collected cash to Portal
  }
};

/**
 * Calculate dynamic seller settlement for an order or item
 * @param {number} grossSale - Customer sale price (net of customer coupon/offer discounts)
 * @param {object} options - Options containing commissionRate, paymentMethod, deliveryMode, deliveryChargeBorneBy, etc.
 * @returns {object} Full financial breakdown with final seller settlement
 */
export function calculateSellerSettlement(grossSale, options = {}) {
  const gross = Math.max(0, Math.round(Number(grossSale || 0) * 100) / 100);

  const rawPaymentMethod = String(options.paymentMethod || "UPI").toUpperCase();
  const isCod = rawPaymentMethod.includes("COD") ||
                rawPaymentMethod.includes("CASH") ||
                rawPaymentMethod.includes("DELIVERY") ||
                rawPaymentMethod === "PAY_ON_DELIVERY" ||
                rawPaymentMethod === "CASH_ON_DELIVERY";
  const isOnline = !isCod;

  const rawDeliveryMode = String(options.deliveryMode || options.deliveryType || "").toLowerCase();
  const hasCourier = Boolean(options.courierName && options.courierName !== "N/A" && options.courierName !== "");
  const isThirdParty = options.isThirdParty === true || 
                       rawDeliveryMode.includes("third") || 
                       rawDeliveryMode.includes("courier") || 
                       (hasCourier && !rawDeliveryMode.includes("self")) ||
                       options.isSelfDelivery === false;
  const isSelfDelivery = !isThirdParty;

  // Determine active rule:
  // Rule 4: COD + Third-Party Courier Delivery (कैश भुगतान + कूरियर से डिलीवरी)
  // Rule 3: COD + Self Delivery (कैश भुगतान + सेलर की डिलीवरी)
  // Rule 2: Online Payment + Third-Party Courier Delivery
  // Rule 1: Online Payment + Self Delivery
  let rule;
  if (isCod && isThirdParty) {
    rule = SETTLEMENT_RULES.COD_THIRD_PARTY_DELIVERY;
  } else if (isCod && isSelfDelivery) {
    rule = SETTLEMENT_RULES.COD_SELF_DELIVERY;
  } else if (isThirdParty) {
    rule = SETTLEMENT_RULES.ONLINE_THIRD_PARTY_DELIVERY;
  } else {
    rule = SETTLEMENT_RULES.ONLINE_SELF_DELIVERY;
  }

  const isRule3CodSelf = rule.code === "COD_SELF_DELIVERY";

  // 1. Platform Commission Rate (Default 10%)
  const commissionRate = (options.commissionRate !== undefined && options.commissionRate !== null && !isNaN(Number(options.commissionRate)))
    ? Number(options.commissionRate)
    : rule.defaultCommissionRate;

  // 2. GST on Commission Rate (18%)
  const gstOnCommissionRate = (options.gstOnCommissionRate !== undefined && !isNaN(Number(options.gstOnCommissionRate)))
    ? Number(options.gstOnCommissionRate)
    : rule.gstOnCommissionRate;

  // 3. TDS Rate (0.1% under Sec 194-O)
  const tdsRate = (options.tdsRate !== undefined && !isNaN(Number(options.tdsRate)))
    ? Number(options.tdsRate)
    : rule.tdsRate;

  // 4. GST TCS Rate & Breakdown (Sec 52)
  // Intra-State: 0.25% CGST + 0.25% SGST (Total 0.5%)
  // Inter-State: 0.5% IGST
  // Rule 3 (COD Self Delivery): 0% TCS (when portal does not collect customer payment)
  let isIntraState = true;
  if (typeof options.isIntraState === "boolean") {
    isIntraState = options.isIntraState;
  } else if (options.sellerState && (options.customerState || options.shippingState || options.buyerState)) {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const s1 = norm(options.sellerState);
    const s2 = norm(options.customerState || options.shippingState || options.buyerState);
    if (s1 && s2) {
      const isUp1 = s1 === "up" || s1.includes("uttarpradesh");
      const isUp2 = s2 === "up" || s2.includes("uttarpradesh");
      if (isUp1 && isUp2) {
        isIntraState = true;
      } else {
        isIntraState = s1 === s2;
      }
    }
  }

  // Resolve Product GST Rate & Base Taxable Amount (बिना GST वाले पैसे)
  // नियम: "टीसीएस ग्रॉस वैल्यू पर नहीं कटता, यह सिर्फ 'बेस अमाउंट' (बिना जीएसटी वाले पैसे) पर कटता है।"
  // नियम: "अगर कोई आइटम टैक्स-फ्री है (जैसे किताबें, जिन पर 0% जीएसटी है), तो उस पर टीसीएस बिल्कुल नहीं कटेगा (TCS = 0)।"
  const rawGstRate = (options.gstRate !== undefined && options.gstRate !== null && !isNaN(Number(options.gstRate)))
    ? Number(options.gstRate)
    : (options.gstPercentage !== undefined && options.gstPercentage !== null && !isNaN(Number(options.gstPercentage)))
      ? Number(options.gstPercentage)
      : (options.gstPercent !== undefined && options.gstPercent !== null && !isNaN(Number(options.gstPercent)))
        ? Number(options.gstPercent)
        : (options.gst !== undefined && options.gst !== null && !isNaN(Number(options.gst)))
          ? Number(options.gst)
          : (options.productGstRate !== undefined && options.productGstRate !== null && !isNaN(Number(options.productGstRate)))
            ? Number(options.productGstRate)
            : (options.taxRate !== undefined && options.taxRate !== null && !isNaN(Number(options.taxRate)))
              ? Number(options.taxRate)
              : null;

  const itemCategory = String(options.category || options.productCategory || "").toLowerCase();
  const itemName = String(options.name || options.productName || "").toLowerCase();
  const isBookOrExemptCategory = itemCategory.includes("book") || itemCategory.includes("textbook") || itemName.includes("book") || itemName.includes("ncert");

  const productGstRate = rawGstRate !== null
    ? rawGstRate
    : (isBookOrExemptCategory ? 0 : 5);

  const isTaxFree = productGstRate === 0 || options.isTaxFree === true || options.isExempt === true;

  // Base Amount calculation (Taxable Value without GST):
  let baseAmount;
  if (options.baseAmount !== undefined && options.baseAmount !== null && !isNaN(Number(options.baseAmount))) {
    baseAmount = Math.max(0, Math.round(Number(options.baseAmount) * 100) / 100);
  } else if (options.taxableValue !== undefined && options.taxableValue !== null && !isNaN(Number(options.taxableValue))) {
    baseAmount = Math.max(0, Math.round(Number(options.taxableValue) * 100) / 100);
  } else if (isTaxFree) {
    baseAmount = gross;
  } else {
    // gross includes GST, so baseAmount = gross / (1 + gstRate/100)
    baseAmount = Math.max(0, Math.round((gross / (1 + (productGstRate / 100))) * 100) / 100);
  }

  const baseGstTcsRate = isRule3CodSelf
    ? 0
    : ((options.gstTcsRate !== undefined && !isNaN(Number(options.gstTcsRate)))
        ? Number(options.gstTcsRate)
        : rule.gstTcsRate);

  // 4. GST TCS Rate & Breakdown (Sec 52)
  // TCS applies only to taxable supplies (productGstRate > 0)
  // For 0% GST items (books/tax-free), GST TCS is strictly 0!
  // For Rule 3 COD Self Delivery (portal does not collect funds), GST TCS is strictly 0!
  const isTcsApplicable = !isRule3CodSelf && !isTaxFree && baseGstTcsRate > 0 && baseAmount > 0;

  let cgstTcsRate = 0;
  let sgstTcsRate = 0;
  let igstTcsRate = 0;
  let cgstTcsAmount = 0;
  let sgstTcsAmount = 0;
  let igstTcsAmount = 0;
  let gstTcsRate = isTcsApplicable ? baseGstTcsRate : 0;
  let gstTcsAmount = 0;

  if (isTcsApplicable) {
    if (isIntraState) {
      cgstTcsRate = Math.round((baseGstTcsRate / 2) * 1000) / 1000; // 0.25%
      sgstTcsRate = Math.round((baseGstTcsRate / 2) * 1000) / 1000; // 0.25%
      igstTcsRate = 0;
      cgstTcsAmount = Math.round(((baseAmount * cgstTcsRate) / 100) * 100) / 100;
      sgstTcsAmount = Math.round(((baseAmount * sgstTcsRate) / 100) * 100) / 100;
      igstTcsAmount = 0;
      gstTcsAmount = Math.round((cgstTcsAmount + sgstTcsAmount) * 100) / 100;
    } else {
      cgstTcsRate = 0;
      sgstTcsRate = 0;
      igstTcsRate = baseGstTcsRate; // 0.5%
      cgstTcsAmount = 0;
      sgstTcsAmount = 0;
      igstTcsAmount = Math.round(((baseAmount * igstTcsRate) / 100) * 100) / 100;
      gstTcsAmount = igstTcsAmount;
    }
  }

  // Exact calculations rounded to 2 decimal places (paisa accuracy)
  const commissionAmount = Math.round(((gross * commissionRate) / 100) * 100) / 100;
  const gstOnCommissionAmount = Math.round(((commissionAmount * gstOnCommissionRate) / 100) * 100) / 100;
  // 3. TDS (Sec 194-O): हमेशा 'Gross Value' (टोटल पैसे) पर कटता है (0.1% of Gross Sale).
  // प्रोडक्ट पर GST है या नहीं, इससे TDS को कोई मतलब नहीं है।
  const tdsAmount = Math.round(((gross * tdsRate) / 100) * 100) / 100;

  // 5. Delivery Charges + 18% GST (Rule 2 & Rule 4: Third-Party Delivery)
  // "₹400 से कम के ऑर्डर पर पोर्टल की डिलीवरी नीति के अनुसार चार्ज लागू होंगे।"
  // "₹400 से अधिक के ऑर्डर पर डिलीवरी का खर्च एडमिन उठाएगा, तो सेलर से यह खर्च नहीं काटना है।"
  const totalOrderValue = Number(options.orderTotal || options.totalAmount || gross);
  const isAbove400 = totalOrderValue > 400;
  const adminBearsDeliveryAbove400 = options.adminBearsDeliveryAbove400 !== false;

  let deliveryChargeBorneBy = options.deliveryChargeBorneBy;
  if (!deliveryChargeBorneBy) {
    if (isAbove400 && adminBearsDeliveryAbove400) {
      deliveryChargeBorneBy = "admin";
    } else if (options.isDeliveryBorneBySeller || options.deliveryBorneBy === "seller") {
      deliveryChargeBorneBy = "seller";
    } else if (Number(options.shippingFee || options.shippingAmount || 0) > 0) {
      deliveryChargeBorneBy = "customer";
    } else {
      // For third-party courier delivery <= 400 where shipping is not charged to customer, seller bears delivery
      deliveryChargeBorneBy = isThirdParty ? "seller" : "admin";
    }
  }

  // If order is > ₹400 and admin absorbs it, seller is never deducted for delivery
  const isDeliveryExemptedForSeller = isAbove400 && adminBearsDeliveryAbove400;

  let deliveryChargeAmount = 0;
  let gstOnDeliveryRate = 18;
  let gstOnDeliveryAmount = 0;
  let totalDeliveryDeduction = 0;

  if (isThirdParty && deliveryChargeBorneBy === "seller" && !isDeliveryExemptedForSeller) {
    const rawDeliveryFee = Math.max(0, Number(options.deliveryCharge ?? options.shippingAmount ?? options.shippingFee ?? 40));
    deliveryChargeAmount = Math.round(rawDeliveryFee * 100) / 100;
    gstOnDeliveryAmount = Math.round(((deliveryChargeAmount * gstOnDeliveryRate) / 100) * 100) / 100;
    totalDeliveryDeduction = Math.round((deliveryChargeAmount + gstOnDeliveryAmount) * 100) / 100;
  }

  const statutoryDeductions = Math.round(
    (commissionAmount + gstOnCommissionAmount + tdsAmount + gstTcsAmount) * 100
  ) / 100;

  const totalDeductions = Math.round(
    (statutoryDeductions + totalDeliveryDeduction) * 100
  ) / 100;

  // Final Settlement Calculation:
  // For Rule 1 & 2 (Online payment): Portal collected gross, so it pays seller (Gross - Deductions)
  // For Rule 3 (COD + Self Delivery): Customer paid seller in cash directly. Portal collected ₹0.
  // Seller owes portal (Commission + GST on Commission + TDS).
  // Settlement is negative (-totalDeductions) to be deposited or adjusted in seller wallet.
  // For Rule 4 (COD + Courier): Courier remits cash to portal, so portal pays seller (Gross - Deductions).
  const netSettlement = isRule3CodSelf
    ? Math.round(-totalDeductions * 100) / 100
    : Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

  return {
    ruleCode: rule.code,
    ruleNumber: rule.ruleNumber,
    ruleName: rule.name,
    ruleNameHi: rule.nameHi,
    isCod,
    isOnline,
    isSelfDelivery,
    isThirdParty,
    isSellerCollectedCash: isRule3CodSelf,
    cashCollectedBy: isRule3CodSelf ? "seller" : "portal",
    grossSale: gross,
    productGstRate,
    isTaxFree,
    baseAmount,
    taxableValue: baseAmount,
    commissionRate,
    commissionAmount,
    gstOnCommissionRate,
    gstOnCommissionAmount,
    tdsRate,
    tdsAmount,
    // GST TCS full dynamic breakdown (Sec 52)
    isIntraState,
    gstTcsRate,
    gstTcsAmount,
    cgstTcsRate,
    cgstTcsAmount,
    sgstTcsRate,
    sgstTcsAmount,
    igstTcsRate,
    igstTcsAmount,
    // Delivery charges breakdown (Rule 2 & 4: ₹400 policy)
    isAbove400,
    deliveryChargeBorneBy,
    deliveryChargeAmount,
    gstOnDeliveryRate,
    gstOnDeliveryAmount,
    totalDeliveryDeduction,
    // Aggregates
    statutoryDeductions,
    totalDeductions,
    netSettlement,
    finalSellerSettlement: netSettlement
  };
}

export default {
  SETTLEMENT_RULES,
  calculateSellerSettlement
};
