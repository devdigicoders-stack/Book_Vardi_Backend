import mongoose from "mongoose";
import Order, { generateProductOrderId } from "../models/Order.js";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import User from "../models/User.js";
import { enrichOrdersWithSellerAndConsumer, findOrderById, calculateOverallOrderStatus } from "./orderController.js";
import { sendDeliveryPartnerWhatsAppDispatch } from "../services/whatsappService.js";

// Canonical Order Status Normalizer
export const normalizeOrderStatus = (raw) => {
  if (!raw) return "Pending";
  const s = String(raw).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (s === "delivered" || s === "completed") return "Delivered";
  if (s === "out_for_delivery") return "Out for Delivery";
  if (s === "shipped" || s === "in_transit") return "Shipped";
  if (s === "packed") return "Packed";
  if (s === "confirmed") return "Confirmed";
  if (s === "processing") return "Processing";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "return_requested") return "Return Requested";
  if (s === "return_approved") return "Return Approved";
  if (s === "product_return_received" || s === "product_received") return "Product Return Received";
  if (s === "refund_requested") return "Refund Requested";
  if (s === "refund_approved") return "Refund Approved";
  if (s === "refund_initiated") return "Refund Initiated";
  if (s === "refund_completed" || s === "refunded") return "Refund Completed";
  if (s === "exchange_requested") return "Exchange Requested";
  if (s === "exchange_approved") return "Exchange Approved";
  if (s === "exchange_dispatched") return "Exchange Dispatched";
  if (s === "exchanged") return "Exchanged";
  if (s === "pending" || s === "placed") return "Pending";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

// Use the configured frontend app base URL so delivery links work on local and deployed hosts.
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || process.env.CLIENT_URL || "http://localhost:3000";

// Helper to extract authenticated seller ID
const resolveSellerId = (req) => {
  const id = req.user?.id || req.seller?._id || req.seller?.id || req.user?._id || req.user?.phone || req.headers["x-seller-id"] || req.query?.sellerId || null;
  if (!id || id === "undefined" || id === "null" || id === "[object Object]") return null;
  return id;
};

// Helper to expand seller scope across Seller/User collections, products, and regex names
const getExpandedSellerScope = async (req) => {
  try {
    const primaryId = resolveSellerId(req);
    const rawIds = [
      primaryId,
      req.user?.id,
      req.seller?._id,
      req.seller?.id,
      req.user?._id,
      req.user?.phone,
      req.seller?.phone,
      req.headers["x-seller-id"],
      req.headers["x-user-phone"],
      req.query?.sellerId
    ].filter(id => id && id !== "undefined" && id !== "null" && id !== "[object Object]");

    const sellerSet = new Set();
    rawIds.forEach((id) => {
      sellerSet.add(String(id));
      if (mongoose.Types.ObjectId.isValid(id)) {
        sellerSet.add(new mongoose.Types.ObjectId(id));
      }
    });

    const validObjectIds = rawIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const phoneList = rawIds.map((id) => String(id).replace(/\D/g, "")).filter((p) => p.length >= 8);
    const phoneVariants = phoneList.flatMap((p) => {
      const digits10 = p.slice(-10);
      return [p, digits10, `+91${digits10}`, `+91 ${digits10}`];
    });

    const orConditions = [
      ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
      ...(phoneVariants.length > 0 ? [{ phone: { $in: phoneVariants } }] : [])
    ];

    if (orConditions.length > 0) {
      const sellerDocs = await Seller.find({ $or: orConditions }).select("_id phone email storeName legalName");
      sellerDocs.forEach((doc) => {
        if (doc._id) {
          sellerSet.add(doc._id);
          sellerSet.add(String(doc._id));
        }
        if (doc.storeName) sellerSet.add(doc.storeName);
        if (doc.legalName) sellerSet.add(doc.legalName);
        if (doc.phone) {
          sellerSet.add(doc.phone);
          const cleanP = String(doc.phone).replace(/\D/g, "");
          if (cleanP) {
            sellerSet.add(cleanP);
            sellerSet.add(cleanP.slice(-10));
            sellerSet.add(`+91${cleanP.slice(-10)}`);
            sellerSet.add(`+91 ${cleanP.slice(-10)}`);
          }
        }
        if (doc.email) sellerSet.add(doc.email);
      });

      const userDocs = await User.find({ $or: orConditions }).select("_id phone email name");
      userDocs.forEach((doc) => {
        if (doc._id) {
          sellerSet.add(doc._id);
          sellerSet.add(String(doc._id));
        }
        if (doc.name) sellerSet.add(doc.name);
        if (doc.phone) {
          sellerSet.add(doc.phone);
          const cleanP = String(doc.phone).replace(/\D/g, "");
          if (cleanP) {
            sellerSet.add(cleanP);
            sellerSet.add(cleanP.slice(-10));
            sellerSet.add(`+91${cleanP.slice(-10)}`);
            sellerSet.add(`+91 ${cleanP.slice(-10)}`);
          }
        }
        if (doc.email) sellerSet.add(doc.email);
      });
    }

    const expandedSellerIds = Array.from(sellerSet);
    const strExpandedSellerIds = expandedSellerIds.map(String);
    const validScopeObjectIds = expandedSellerIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (expandedSellerIds.length === 0) {
      return { expandedSellerIds: [], strExpandedSellerIds: [], allProductKeys: [], productNameRegexes: [], filter: { _id: null } };
    }

    const productOrConditions = [];
    if (validScopeObjectIds.length > 0) {
      productOrConditions.push(
        { sellerId: { $in: validScopeObjectIds } },
        { seller: { $in: validScopeObjectIds } },
        { userId: { $in: validScopeObjectIds } },
        { user: { $in: validScopeObjectIds } },
        { createdBy: { $in: validScopeObjectIds } }
      );
    }
    if (strExpandedSellerIds.length > 0) {
      productOrConditions.push(
        { sellerStoreName: { $in: strExpandedSellerIds } },
        { storeName: { $in: strExpandedSellerIds } },
        { sellerName: { $in: strExpandedSellerIds } }
      );
    }

    const sellerProducts = productOrConditions.length > 0
      ? await Product.find({ $or: productOrConditions }).select("_id id name title")
      : [];

    const productIds = sellerProducts.map((p) => p._id);
    const strProductIds = productIds.map((id) => String(id));
    const customProductIds = sellerProducts.map((p) => p.id).filter(Boolean);
    const numericProductIds = customProductIds.map(Number).filter((n) => !isNaN(n));
    const productNames = sellerProducts.map((p) => (p.name || p.title || "").trim()).filter(Boolean);

    const productNameRegexes = productNames
      .map((name) => (name || "").replace(/\s*\([^)]*\)/g, "").trim())
      .filter((cleanName) => cleanName.length > 0)
      .map((cleanName) => new RegExp(cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const allProductKeys = [...new Set([...productIds, ...strProductIds, ...customProductIds, ...numericProductIds])];

    const orderOrConditions = [];
    if (validScopeObjectIds.length > 0) {
      orderOrConditions.push(
        { sellerId: { $in: validScopeObjectIds } },
        { seller: { $in: validScopeObjectIds } },
        { "items.sellerId": { $in: validScopeObjectIds } },
        { "items.seller": { $in: validScopeObjectIds } }
      );
    }
    if (strExpandedSellerIds.length > 0) {
      orderOrConditions.push(
        { "items.sellerPhone": { $in: strExpandedSellerIds } },
        { "items.sellerEmail": { $in: strExpandedSellerIds } },
        { "items.storeName": { $in: strExpandedSellerIds } },
        { storeName: { $in: strExpandedSellerIds } },
        { sellerStoreName: { $in: strExpandedSellerIds } }
      );
    }
    if (allProductKeys.length > 0) {
      orderOrConditions.push(
        { "items.productId": { $in: allProductKeys } },
        { "items.id": { $in: allProductKeys } },
        { "items._id": { $in: allProductKeys } }
      );
    }

    const filter = orderOrConditions.length > 0 ? { $or: orderOrConditions } : { _id: null };

    return { expandedSellerIds, strExpandedSellerIds, allProductKeys, productNameRegexes, filter };
  } catch (err) {
    console.error("Error in getExpandedSellerScope:", err);
    return { expandedSellerIds: [], strExpandedSellerIds: [], allProductKeys: [], productNameRegexes: [], filter: { _id: null } };
  }
};

// Helper to format a single Order document for seller view
export const formatSellerSingleOrder = (o, scope = null) => {
  if (!o) return null;
  const customerObj = o.customer || {};
  const itemsList = Array.isArray(o.items) ? o.items : [];
  const strExpandedSellerIds = scope?.strExpandedSellerIds;
  const strAllProductKeys = scope?.allProductKeys ? scope.allProductKeys.map(String) : [];
  const productNameRegexes = scope?.productNameRegexes || [];

  const relevantItems = itemsList.filter((item) => {
    if (!strExpandedSellerIds || !strExpandedSellerIds.length) return true;
    const itemSellerIdStr = item.sellerId ? String(item.sellerId._id || item.sellerId) : "";
    const itemSellerStr = item.seller ? String(item.seller._id || item.seller) : "";
    const itemStoreNameStr = item.storeName ? String(item.storeName) : "";

    const matchSeller = strExpandedSellerIds.some((sId) => {
      if (!sId) return false;
      const cleanSId = String(sId).toLowerCase();
      return (
        (itemSellerIdStr && (itemSellerIdStr === sId || (sId.length >= 8 && itemSellerIdStr.endsWith(sId.slice(-10))))) ||
        (itemSellerStr && (itemSellerStr === sId || (sId.length >= 8 && itemSellerStr.endsWith(sId.slice(-10))))) ||
        (itemStoreNameStr && itemStoreNameStr.toLowerCase() === cleanSId)
      );
    });

    const matchProduct = (item.productId || item.id || item._id) && strAllProductKeys.includes(String(item.productId?._id || item.productId || item.id || item._id));
    const matchName = item.name && productNameRegexes.some((regex) => regex.test(item.name));
    return matchSeller || matchProduct || matchName;
  });

  if (relevantItems.length === 0 && strExpandedSellerIds && strExpandedSellerIds.length > 0) {
    return null;
  }

  const orderItems = relevantItems.length > 0 ? relevantItems : itemsList;
  const isMultiSeller = itemsList.length > orderItems.length;

  const computedItemsSubtotal = orderItems.reduce(
    (sum, item) => sum + (Number(item.total) || (Number(item.price || item.finalPrice || 0) * Number(item.quantity || 1))),
    0
  );

  const storedOrderTotal = Number(o.totalAmount || o.total || 0);
  const storedSubtotal = Number(o.subtotal || 0);
  const shippingFee = Number(o.shippingFee ?? o.shippingCost ?? 0);
  const discountAmount = Number(o.discountAmount ?? o.discount ?? 0);
  const codFee = Number(o.codFee ?? o.codCharges ?? 0);

  const resolvedOrderTotal = isMultiSeller
    ? computedItemsSubtotal
    : (storedOrderTotal > 0 ? storedOrderTotal : Math.max(0, computedItemsSubtotal + shippingFee + codFee - discountAmount));

  const resolvedSubtotal = computedItemsSubtotal;

  const sellerItemStatus = relevantItems.find(i => i.status && normalizeOrderStatus(i.status) !== "Pending")?.status;
  const hasActiveReturnRequest = o.returnRequest &&
    typeof o.returnRequest === "object" &&
    Boolean(o.returnRequest.type && !['none', 'n/a', '', 'null'].includes(String(o.returnRequest.type).toLowerCase().trim())) &&
    Boolean(o.returnRequest.status && !['none', 'n/a', 'no_request', 'normal', 'null', ''].includes(String(o.returnRequest.status).toLowerCase().trim()));

  const rawStatus = hasActiveReturnRequest
    ? o.returnRequest.status
    : (o.overallStatus || sellerItemStatus || o.status || "Pending");

  const formattedStatus = normalizeOrderStatus(rawStatus);

  let rawOrderId = o.orderId || o.id;
  if (!rawOrderId || /^[0-9a-fA-F]{24}$/.test(rawOrderId)) {
    rawOrderId = generateProductOrderId();
    Order.updateOne({ _id: o._id }, { $set: { orderId: rawOrderId, id: rawOrderId } }).exec().catch(() => {});
  }

  return {
    id: rawOrderId,
    _id: o._id,
    orderId: rawOrderId,
    customerName: customerObj.name || o.userName || o.customerName || "Customer",
    customerEmail: customerObj.email || o.userEmail || o.customerEmail || "",
    customerPhone: customerObj.phone || o.userPhone || o.customerPhone || "",
    school: o.schoolName || o.school || customerObj.school || "General Public",
    date: o.date
      ? o.date
      : o.createdAt
      ? new Date(o.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata"
        })
      : "Recently",
    createdAt: o.createdAt || new Date(),
    total: resolvedOrderTotal,
    totalAmount: resolvedOrderTotal,
    subtotal: resolvedSubtotal,
    sellerSubtotal: computedItemsSubtotal,
    shippingFee: isMultiSeller ? 0 : shippingFee,
    shippingCost: isMultiSeller ? 0 : shippingFee,
    discountAmount: isMultiSeller ? 0 : discountAmount,
    discount: isMultiSeller ? 0 : discountAmount,
    codFee: isMultiSeller ? 0 : codFee,
    itemsCount: orderItems.length,
    status: formattedStatus,
    overallStatus: formattedStatus,
    rawStatus: rawStatus,
    paymentMethod: o.paymentMethod || "UPI",
    paymentStatus: o.paymentStatus || (String(o.paymentMethod || "").toUpperCase().includes("COD") ? "pending" : "Paid"),
    cancellationReason: o.cancellationReason || "",
    cancelledBy: o.cancelledBy || (o.cancellationReason ? "Customer" : ""),
    cancelledAt: o.cancelledAt || null,
    refundStatus: o.refundStatus || "",
    returnRequest: o.returnRequest || null,
    refundDetails: o.refundDetails || o.returnRequest?.refundDetails || null,
    timeline: o.timeline || [],
    shippingAddress: typeof o.shippingAddress === "string"
      ? o.shippingAddress
      : (o.shippingAddress?.street ? `${o.shippingAddress.street}, ${o.shippingAddress.city || ""}` : "Customer Address"),
    deliveryMode: o.deliveryMode || (o.selfDeliveryDetails?.deliveryPartnerToken ? "self_delivery" : (o.courierName ? "third_party" : (orderItems[0]?.deliveryType === "self" || orderItems[0]?.deliveryType === "self_delivery" ? "self_delivery" : ""))),
    deliveryType: o.deliveryMode || (o.selfDeliveryDetails?.deliveryPartnerToken ? "self_delivery" : (o.courierName ? "third_party" : (orderItems[0]?.deliveryType === "self" || orderItems[0]?.deliveryType === "self_delivery" ? "self_delivery" : ""))),
    trackingNumber: o.trackingNumber || orderItems[0]?.thirdPartyDetails?.trackingNumber || "",
    courierName: o.courierName || orderItems[0]?.thirdPartyDetails?.courierName || "",
    trackingUrl: o.trackingUrl || orderItems[0]?.thirdPartyDetails?.trackingUrl || "",
    sellerDetails: o.sellerDetails || orderItems[0]?.sellerDetails || null,
    selfDeliveryDetails: o.selfDeliveryDetails || orderItems[0]?.selfDeliveryDetails || null,
    items: orderItems.map((item) => ({
      id: item._id || item.id,
      _id: item._id || item.id,
      name: item.name || "Product Item",
      price: Number(item.price || item.finalPrice || 0),
      quantity: Number(item.quantity || 1),
      total: Number(item.total || (item.price * item.quantity) || 0),
      size: item.size || "",
      color: item.color || "",
      image: item.image || "",
      status: normalizeOrderStatus(item.status || formattedStatus),
      deliveryType: item.deliveryType || o.deliveryMode || "",
      selfDeliveryDetails: item.selfDeliveryDetails || o.selfDeliveryDetails || null,
      thirdPartyDetails: item.thirdPartyDetails || { courierName: o.courierName, trackingNumber: o.trackingNumber, trackingUrl: o.trackingUrl },
      sellerDetails: item.sellerDetails || o.sellerDetails || null
    }))
  };
};

// 1. Get All Orders for the Logged-in Seller
export const getSellerOrders = async (req, res) => {
  try {
    const scope = await getExpandedSellerScope(req);
    const orders = await Order.find(scope.filter).sort({ createdAt: -1 });
    const formattedOrders = orders.map((o) => formatSellerSingleOrder(o, scope));
    res.json(formattedOrders.filter(Boolean));
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    res.status(200).json([]);
  }
};

// 2. Get Dynamic Customer & Parent Records for Logged-in Seller
export const getSellerCustomers = async (req, res) => {
  try {
    const { expandedSellerIds, allProductKeys, productNameRegexes, filter } = await getExpandedSellerScope(req);
    const orders = await Order.find(filter).sort({ createdAt: -1 });

    const customerMap = new Map();

    orders.forEach((order) => {
      const c = order.customer || {};
      const name = c.name || order.userName || order.customerName || "Valued Parent / Customer";
      const email = c.email || order.userEmail || order.customerEmail || "";
      const phone = c.phone || order.userPhone || order.customerPhone || "";
      const key = (phone || email || name).toLowerCase().trim();
      if (!key) return;

      const itemsList = Array.isArray(order.items) ? order.items : [];
      const strExpandedSellerIds = expandedSellerIds.map(String);
      const strAllProductKeys = allProductKeys.map(String);

      const sellerItems = itemsList.filter((item) => {
        if (!expandedSellerIds.length) return true;
        const matchSeller = item.sellerId && strExpandedSellerIds.includes(String(item.sellerId));
        const matchProduct = (item.productId || item.id) && strAllProductKeys.includes(String(item.productId || item.id));
        const matchName = item.name && productNameRegexes.some((regex) => regex.test(item.name));
        return matchSeller || matchProduct || matchName;
      });

      const relevantItems = sellerItems.length > 0 ? sellerItems : itemsList;
      const sellerSubtotal = relevantItems.reduce(
        (acc, item) => acc + (Number(item.total) || (Number(item.price || item.finalPrice || 0) * Number(item.quantity || 1))),
        0
      );

      const orderTotal = sellerSubtotal > 0 ? sellerSubtotal : Number(order.totalAmount || order.total || order.subtotal || 0);

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: `CUST-${Math.floor(10000 + Math.random() * 90000)}`,
          name: name,
          email: email,
          phone: phone,
          schoolAffiliation: order.schoolName || order.school || c.school || "General Public",
          studentName: c.studentName || order.studentName || "",
          totalOrders: 1,
          totalSpend: orderTotal,
          status: orderTotal >= 5000 ? "VIP" : "Active",
          lastOrderDate: order.date
            ? order.date
            : order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
            : "Recently"
        });
      } else {
        const existing = customerMap.get(key);
        existing.totalOrders += 1;
        existing.totalSpend += orderTotal;
        if (existing.totalSpend >= 5000) existing.status = "VIP";
      }
    });

    res.json(Array.from(customerMap.values()));
  } catch (error) {
    console.error("Error fetching seller customers:", error);
    res.status(200).json([]);
  }
};

const resolveCarrierTrackingUrl = (courier, tracking) => {
  if (!tracking) return "";
  const c = String(courier || "").toLowerCase().trim();
  const cleanAwb = String(tracking).trim();
  if (c.includes("delhivery")) {
    return `https://www.delhivery.com/track/package/${cleanAwb}`;
  }
  if (c.includes("bluedart") || c.includes("blue dart")) {
    return `https://www.bluedart.com/tracking?awb=${cleanAwb}`;
  }
  if (c.includes("dtdc")) {
    return `https://www.dtdc.in/tracking/shipment-tracking.asp?awb=${cleanAwb}`;
  }
  if (c.includes("ekart")) {
    return `https://ekartlogistics.com/shipmenttrack/${cleanAwb}`;
  }
  if (c.includes("indiapost") || c.includes("speedpost") || c.includes("india post")) {
    return `https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx`;
  }
  return `https://track.shiprocket.in/tracking/${cleanAwb}`;
};

const resolveSellerProfileDetails = async (req, fallbackOrder) => {
  const sellerId = resolveSellerId(req);
  let sellerProfile = null;
  if (sellerId) {
    if (mongoose.Types.ObjectId.isValid(sellerId)) {
      sellerProfile = await Seller.findById(sellerId).select("name storeName phone email address city");
      if (!sellerProfile) {
        sellerProfile = await User.findById(sellerId).select("name storeName phone email address city");
      }
    } else {
      sellerProfile = await Seller.findOne({ $or: [{ phone: sellerId }, { email: sellerId }] }).select("name storeName phone email address city");
      if (!sellerProfile) {
        sellerProfile = await User.findOne({ $or: [{ phone: sellerId }, { email: sellerId }] }).select("name storeName phone email address city");
      }
    }
  }

  const existingSeller = fallbackOrder?.sellerDetails || {};
  return {
    sellerId: sellerId || existingSeller.sellerId || req.user?.id || null,
    storeName: req.body.sellerDetails?.storeName || req.user?.storeName || sellerProfile?.storeName || sellerProfile?.name || existingSeller.storeName || "Partner Merchant",
    sellerName: req.body.sellerDetails?.sellerName || req.user?.name || sellerProfile?.name || sellerProfile?.storeName || existingSeller.sellerName || "Partner Merchant",
    phone: req.body.sellerDetails?.phone || req.user?.phone || sellerProfile?.phone || existingSeller.phone || "",
    email: req.body.sellerDetails?.email || req.user?.email || sellerProfile?.email || existingSeller.email || "",
    address: req.body.sellerDetails?.address || sellerProfile?.address || existingSeller.address || "",
    city: req.body.sellerDetails?.city || sellerProfile?.city || existingSeller.city || ""
  };
};

// 3. Update Order Item Status & Delivery Method by Seller
export const updateSellerOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const {
      status,
      deliveryType,
      deliveryMode,
      selfDeliveryDetails,
      thirdPartyDetails,
      sellerDetails
    } = req.body;

    const order = await findOrderById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    let item = null;
    if (order.items && Array.isArray(order.items)) {
      item = order.items.find(i => String(i._id) === String(itemId) || String(i.id) === String(itemId));
    }

    if (!item && order.items && order.items.length > 0) {
      item = order.items[0];
    }

    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    let rawMode = deliveryMode || deliveryType || item.deliveryType || "pending_choice";
    if (rawMode === "self") rawMode = "self_delivery";
    if (rawMode === "courier") rawMode = "third_party";
    const validModes = ["third_party", "self_delivery", "pending_choice", "standard", "express", ""];
    const resolvedMode = validModes.includes(rawMode) ? rawMode : "pending_choice";

    const formattedStatus = status
      ? normalizeOrderStatus(status)
      : normalizeOrderStatus(item.status || order.status || "Pending");

    if (status) {
      item.status = formattedStatus;
      const computedOverall = calculateOverallOrderStatus(order.items);
      order.status = computedOverall;
      order.overallStatus = computedOverall;
    }
    if (deliveryType || deliveryMode) {
      item.deliveryType = resolvedMode;
      order.deliveryMode = resolvedMode;
    }

    const sellerInfo = await resolveSellerProfileDetails(req, order);
    item.sellerDetails = sellerInfo;
    item.storeName = sellerInfo.storeName;
    item.sellerName = sellerInfo.sellerName;
    item.sellerPhone = sellerInfo.phone;
    order.sellerDetails = sellerInfo;

    if (selfDeliveryDetails) {
      const clientAppUrl = (process.env.CLIENT_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, '');
      const tokenVal = String(
        selfDeliveryDetails.deliveryPartnerToken ||
        item.selfDeliveryDetails?.deliveryPartnerToken ||
        order.selfDeliveryDetails?.deliveryPartnerToken ||
        `DLV-${Math.floor(100000 + Math.random() * 900000)}`
      ).trim();
      const trackingLink = `${clientAppUrl}/#delivery-partner?token=${encodeURIComponent(tokenVal)}`;
      const otpVal = selfDeliveryDetails.deliveryOtp || item.selfDeliveryDetails?.deliveryOtp || order.selfDeliveryDetails?.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();

      item.selfDeliveryDetails = {
        ...item.selfDeliveryDetails,
        ...selfDeliveryDetails,
        deliveryPartnerToken: tokenVal,
        trackingUrl: trackingLink,
        deliveryOtp: otpVal
      };
      order.selfDeliveryDetails = item.selfDeliveryDetails;
      order.trackingUrl = trackingLink;
      order.trackingNumber = tokenVal;
    }

    if (thirdPartyDetails) {
      const carrierUrl = thirdPartyDetails.trackingUrl || resolveCarrierTrackingUrl(thirdPartyDetails.courierName, thirdPartyDetails.trackingNumber);
      item.thirdPartyDetails = {
        ...item.thirdPartyDetails,
        ...thirdPartyDetails,
        trackingUrl: carrierUrl
      };
      if (thirdPartyDetails.courierName) order.courierName = thirdPartyDetails.courierName;
      if (thirdPartyDetails.trackingNumber) order.trackingNumber = thirdPartyDetails.trackingNumber;
      if (carrierUrl) order.trackingUrl = carrierUrl;
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: formattedStatus.toLowerCase(),
      title: `Item '${item.name}' ${formattedStatus}`,
      description: `Item status updated to ${formattedStatus} by seller (${sellerInfo.storeName}).`,
      timestamp: new Date(),
      updatedBy: sellerInfo.storeName || "Seller"
    });

    order.markModified('items');
    await order.save();

    res.json({
      success: true,
      message: `Item status updated to ${formattedStatus}. Overall order status: ${order.overallStatus}`,
      status: formattedStatus,
      overallStatus: order.overallStatus,
      item,
      order
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update item delivery & status", error: error.message });
  }
};

// 4. Update Overall Order Status for Seller Order
export const updateSellerOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      status,
      trackingNumber,
      courierName,
      trackingUrl,
      estimatedDeliveryDate,
      deliveryType,
      deliveryMode,
      selfDeliveryDetails,
      sellerDetails
    } = req.body;

    const order = await findOrderById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    const formattedStatus = status
      ? normalizeOrderStatus(status)
      : normalizeOrderStatus(order.status || "Pending");

    const sellerInfo = await resolveSellerProfileDetails(req, order);
    order.sellerDetails = sellerInfo;

    let rawMode = deliveryMode || deliveryType || (selfDeliveryDetails ? "self_delivery" : (courierName || trackingNumber ? "third_party" : (order.deliveryMode || "")));
    if (rawMode === "self") rawMode = "self_delivery";
    if (rawMode === "courier") rawMode = "third_party";
    const validModes = ["third_party", "self_delivery", "pending_choice", "standard", "express", ""];
    const resolvedMode = validModes.includes(rawMode) ? rawMode : "pending_choice";
    order.deliveryMode = resolvedMode;

    let computedTrackingUrl = trackingUrl || "";
    let effectiveAwb = "";
    if (resolvedMode === "third_party") {
      if (courierName) order.courierName = courierName;
      effectiveAwb = trackingNumber || order.trackingNumber || "";
      if (!effectiveAwb && (courierName || order.courierName)) {
        const courierPrefix = String(courierName || order.courierName || "BLUEDART")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 10) || "COURIER";
        effectiveAwb = `${courierPrefix}-${Math.floor(10000000 + Math.random() * 90000000)}`;
      }
      order.trackingNumber = effectiveAwb;
      computedTrackingUrl = trackingUrl || resolveCarrierTrackingUrl(order.courierName, effectiveAwb);
      if (computedTrackingUrl) order.trackingUrl = computedTrackingUrl;
    }

    let mergedSelf = null;
    if (resolvedMode === "self_delivery" || selfDeliveryDetails) {
      const clientAppUrl = (process.env.CLIENT_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, '');
      const tokenVal = String(
        selfDeliveryDetails?.deliveryPartnerToken ||
        order.selfDeliveryDetails?.deliveryPartnerToken ||
        `DLV-${Math.floor(100000 + Math.random() * 900000)}`
      ).trim();
      const trackingLink = `${clientAppUrl}/#delivery-partner?token=${encodeURIComponent(tokenVal)}`;
      const otpVal = selfDeliveryDetails?.deliveryOtp || order.selfDeliveryDetails?.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();

      const sanitizeDriverLocation = (rawLoc) => {
        if (!rawLoc || typeof rawLoc !== 'object') return { lat: null, lng: null, updatedAt: null };
        return {
          lat: typeof rawLoc.lat === 'number' ? rawLoc.lat : (rawLoc.lat ? Number(rawLoc.lat) || null : null),
          lng: typeof rawLoc.lng === 'number' ? rawLoc.lng : (rawLoc.lng ? Number(rawLoc.lng) || null : null),
          updatedAt: rawLoc.updatedAt ? new Date(rawLoc.updatedAt) : null
        };
      };

      const existingDriverLoc = order.selfDeliveryDetails?.driverLocation;
      const inputDriverLoc = selfDeliveryDetails?.driverLocation !== undefined
        ? sanitizeDriverLocation(selfDeliveryDetails.driverLocation)
        : sanitizeDriverLocation(existingDriverLoc);

      mergedSelf = {
        deliveryPersonName: selfDeliveryDetails?.deliveryPersonName || order.selfDeliveryDetails?.deliveryPersonName || "",
        deliveryPersonPhone: selfDeliveryDetails?.deliveryPersonPhone || order.selfDeliveryDetails?.deliveryPersonPhone || "",
        vehicleNumber: selfDeliveryDetails?.vehicleNumber || order.selfDeliveryDetails?.vehicleNumber || "",
        deliveryPartnerToken: tokenVal,
        trackingUrl: trackingLink,
        deliveryOtp: otpVal,
        driverLocation: inputDriverLoc
      };

      order.selfDeliveryDetails = mergedSelf;
      order.trackingUrl = trackingLink;
      order.trackingNumber = tokenVal;
    }

    // Fully Automated WhatsApp Dispatch to Delivery Boy
    let whatsappDispatchResult = null;
    if (resolvedMode === "self_delivery" && mergedSelf && mergedSelf.deliveryPersonPhone) {
      whatsappDispatchResult = await sendDeliveryPartnerWhatsAppDispatch({
        order,
        selfDeliveryDetails: mergedSelf,
        clientAppUrl: req.headers.origin || req.headers.referer
      });

      if (whatsappDispatchResult.success) {
        mergedSelf.whatsappStatus = "sent";
        mergedSelf.whatsappSentAt = whatsappDispatchResult.sentAt;
        mergedSelf.whatsappMessageId = whatsappDispatchResult.messageId;
        mergedSelf.whatsappSentTo = whatsappDispatchResult.sentTo;
      } else {
        mergedSelf.whatsappStatus = "failed";
      }
    }

    // Build update object
    const updatePayload = {
      status: formattedStatus,
      overallStatus: formattedStatus,
      deliveryMode: resolvedMode,
      sellerDetails: sellerInfo
    };

    if (order.returnRequest && (!order.returnRequest.type || ['none', 'n/a', '', 'null'].includes(String(order.returnRequest.type).toLowerCase().trim()))) {
      updatePayload['returnRequest.status'] = 'no_request';
    }

    if (formattedStatus.toLowerCase().includes("delivered")) {
      updatePayload.deliveredAt = order.deliveredAt || new Date();
    }

    if (resolvedMode === "third_party") {
      if (courierName) updatePayload.courierName = courierName;
      if (effectiveAwb) updatePayload.trackingNumber = effectiveAwb;
      if (computedTrackingUrl) updatePayload.trackingUrl = computedTrackingUrl;
    } else if (resolvedMode === "self_delivery" && mergedSelf) {
      updatePayload.selfDeliveryDetails = mergedSelf;
      updatePayload.trackingUrl = mergedSelf.trackingUrl;
      updatePayload.trackingNumber = mergedSelf.deliveryPartnerToken;
    }

    // Build timeline event
    const newTimeline = Array.isArray(order.timeline) ? [...order.timeline] : [];
    const deliveryDesc = resolvedMode === "self_delivery"
      ? `Direct Self-Delivery by ${sellerInfo.storeName} ${mergedSelf?.deliveryPersonName ? `(Rider: ${mergedSelf.deliveryPersonName})` : ''}`
      : (effectiveAwb ? `Courier: ${courierName || order.courierName || 'Express'} (AWB: ${effectiveAwb})` : 'Dispatched via Courier');

    newTimeline.push({
      status: formattedStatus,
      title: `Order ${formattedStatus}`,
      description: `Status updated to ${formattedStatus} by seller (${sellerInfo.storeName}). ${deliveryDesc}`,
      timestamp: new Date(),
      updatedBy: sellerInfo.storeName || "Seller"
    });

    if (whatsappDispatchResult?.success) {
      newTimeline.push({
        status: "whatsapp_sent",
        title: "WhatsApp Link Sent to Delivery Boy",
        description: `Automated WhatsApp dispatch sent to ${mergedSelf.deliveryPersonName} (${mergedSelf.deliveryPersonPhone}) with live tracking portal link: ${mergedSelf.trackingUrl} (Ref: ${whatsappDispatchResult.messageId})`,
        timestamp: new Date(),
        updatedBy: "System (WhatsApp Service)"
      });
    }

    updatePayload.timeline = newTimeline;

    // Also update item statuses in items array for seller's items
    if (Array.isArray(order.items) && order.items.length > 0) {
      const sellerIdStr = String(sellerInfo.sellerId || req.user?.id || '').trim();
      const updatedItems = order.items.map(item => {
        const itemObj = item.toObject ? item.toObject() : item;
        const itemSellerId = String(itemObj.sellerId || itemObj.sellerDetails?.sellerId || '').trim();
        const isBelongingToSeller = !sellerIdStr || !itemSellerId || sellerIdStr === itemSellerId;
        if (!isBelongingToSeller) {
          return itemObj;
        }

        return {
          ...itemObj,
          status: formattedStatus,
          deliveryType: resolvedMode,
          sellerDetails: sellerInfo,
          sellerName: sellerInfo.sellerName,
          storeName: sellerInfo.storeName,
          sellerPhone: sellerInfo.phone,
          ...(resolvedMode === "third_party" ? {
            thirdPartyDetails: {
              ...itemObj.thirdPartyDetails,
              courierName: courierName || itemObj.thirdPartyDetails?.courierName || order.courierName,
              trackingNumber: effectiveAwb || itemObj.thirdPartyDetails?.trackingNumber || order.trackingNumber,
              trackingUrl: computedTrackingUrl || itemObj.thirdPartyDetails?.trackingUrl,
              estimatedDeliveryDate: estimatedDeliveryDate || itemObj.thirdPartyDetails?.estimatedDeliveryDate
            }
          } : {}),
          ...(resolvedMode === "self_delivery" && mergedSelf ? { selfDeliveryDetails: mergedSelf } : {})
        };
      });

      updatePayload.items = updatedItems;
      // LATEST STATUS IS FINAL: If seller explicitly requested status, keep formattedStatus!
      if (!status) {
        const recomputedOverall = calculateOverallOrderStatus(updatedItems);
        updatePayload.status = recomputedOverall;
        updatePayload.overallStatus = recomputedOverall;
      } else {
        updatePayload.status = formattedStatus;
        updatePayload.overallStatus = formattedStatus;
      }
    }

    // Update MongoDB directly using updateOne
    await Order.updateOne({ _id: order._id }, { $set: updatePayload });

    // Fetch updated document and format for seller view to eliminate flicker
    const updatedOrder = await Order.findById(order._id);
    const scope = await getExpandedSellerScope(req);
    const formattedResult = formatSellerSingleOrder(updatedOrder, scope) || updatedOrder;

    res.json({
      success: true,
      message: `Order status updated to ${formattedStatus}`,
      order: formattedResult,
      whatsappDispatch: whatsappDispatchResult
    });
  } catch (error) {
    console.error("Error in updateSellerOrderStatus:", error);
    res.status(500).json({ success: false, message: "Failed to update order status", error: error.message });
  }
};

// Re-send WhatsApp Link to Delivery Boy for an existing Order
export const resendSellerDeliveryBoyWhatsApp = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await findOrderById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const selfDetails = order.selfDeliveryDetails;
    if (!selfDetails || !selfDetails.deliveryPersonPhone) {
      return res.status(400).json({ success: false, message: "No self-delivery partner details found for this order" });
    }

    const dispatchResult = await sendDeliveryPartnerWhatsAppDispatch({
      order,
      selfDeliveryDetails: selfDetails,
      clientAppUrl: req.headers.origin || req.headers.referer
    });

    if (dispatchResult.success) {
      order.selfDeliveryDetails = {
        ...selfDetails,
        whatsappStatus: "sent",
        whatsappSentAt: dispatchResult.sentAt,
        whatsappMessageId: dispatchResult.messageId,
        whatsappSentTo: dispatchResult.sentTo
      };

      order.timeline = order.timeline || [];
      order.timeline.push({
        status: "whatsapp_sent",
        title: "WhatsApp Link Resent to Delivery Boy",
        description: `WhatsApp tracking link re-dispatched to ${selfDetails.deliveryPersonName} (${selfDetails.deliveryPersonPhone}). Ref: ${dispatchResult.messageId}`,
        timestamp: new Date(),
        updatedBy: "Seller (Resend)"
      });

      await order.save();
    }

    res.json({
      success: dispatchResult.success,
      message: dispatchResult.success ? "WhatsApp tracking link dispatched to delivery boy" : dispatchResult.error,
      whatsappDispatch: dispatchResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to dispatch WhatsApp link", error: error.message });
  }
};

// 5. Download Seller Tax Invoice / Packing Slip
export const downloadSellerInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = resolveSellerId(req);

    const order = await findOrderById(orderId);
    if (order) {
      await order.populate("items.productId", "name price images mrp");
      await order.populate("items.sellerId", "storeName name phone city");
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // STRICT CONFIRMATION CHECK: Certificate/Invoice only generated when order is confirmed (Pending orders are locked)
    const status = String(order.overallStatus || order.status || "").toLowerCase().trim();
    const paymentStatus = String(order.paymentStatus || "").toLowerCase().trim();
    const isPending = !status || status === "pending" || status === "unconfirmed" || status === "placed";

    const confirmedStatuses = [
      "confirmed",
      "processing",
      "packed",
      "shipped",
      "dispatched",
      "out_for_delivery",
      "out for delivery",
      "delivered",
      "completed"
    ];

    const isConfirmed = !isPending && (confirmedStatuses.includes(status) || paymentStatus === "paid");

    if (!isConfirmed) {
      return res.status(400).json({
        message: `Tax Invoice & Certificate can only be generated strictly after the order is confirmed by seller/platform. Current status: '${order.overallStatus || order.status || "Pending"}'.`
      });
    }

    const { generateTaxInvoicePDF } = await import("../services/invoiceService.js");

    const orderObj = order.toObject ? order.toObject() : order;
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([orderObj]))[0];

    const filename = `Seller_Invoice_${enrichedOrder.orderId || enrichedOrder._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateTaxInvoicePDF(enrichedOrder, sellerId);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Seller invoice download error:", error);
    res.status(500).json({ message: "Failed to generate seller invoice", error: error.message });
  }
};
