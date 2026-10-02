import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import User from "../models/User.js";
import { enrichOrdersWithSellerAndConsumer } from "./orderController.js";

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

// 1. Get All Orders for the Logged-in Seller
export const getSellerOrders = async (req, res) => {
  try {
    const { expandedSellerIds, strExpandedSellerIds, allProductKeys, productNameRegexes, filter } = await getExpandedSellerScope(req);
    const orders = await Order.find(filter).sort({ createdAt: -1 });

    const strAllProductKeys = (allProductKeys || []).map(String);

    const formattedOrders = orders.map((o) => {
      const customerObj = o.customer || {};
      const itemsList = Array.isArray(o.items) ? o.items : [];

      const relevantItems = itemsList.filter((item) => {
        if (!strExpandedSellerIds || !strExpandedSellerIds.length) return false;
        const itemSellerIdStr = item.sellerId ? String(item.sellerId) : "";
        const itemSellerStr = item.seller ? String(item.seller) : "";
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

        const matchProduct = (item.productId || item.id || item._id) && strAllProductKeys.includes(String(item.productId || item.id || item._id));
        const matchName = item.name && productNameRegexes.some((regex) => regex.test(item.name));
        return matchSeller || matchProduct || matchName;
      });

      const orderItems = relevantItems.length > 0 ? relevantItems : (strExpandedSellerIds.length > 0 ? itemsList : []);
      if (orderItems.length === 0 && itemsList.length > 0) {
        return null;
      }

      const computedTotal = orderItems.reduce(
        (sum, item) => sum + (Number(item.total) || (Number(item.price || item.finalPrice || 0) * Number(item.quantity || 1))),
        0
      );

      const formattedStatus = normalizeOrderStatus(o.overallStatus || o.status || "Pending");

      return {
        id: o.orderId || o.id || String(o._id),
        _id: o._id,
        orderId: o.orderId || o.id || String(o._id),
        customerName: customerObj.name || o.userName || "Customer",
        customerEmail: customerObj.email || o.userEmail || "",
        customerPhone: customerObj.phone || o.userPhone || "",
        school: o.schoolName || o.school || customerObj.school || "General Public",
        date: o.createdAt
          ? new Date(o.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })
          : (o.date || "Recently"),
        createdAt: o.createdAt || new Date(),
        total: computedTotal > 0 ? computedTotal : Number(o.totalAmount || o.subtotal || o.total || 0),
        sellerSubtotal: computedTotal > 0 ? computedTotal : Number(o.totalAmount || o.subtotal || o.total || 0),
        itemsCount: orderItems.length,
        status: formattedStatus,
        rawStatus: o.overallStatus || o.status || "Pending",
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
    });

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
          lastOrderDate: order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : (order.date || "Recently")
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

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: orderId }, { id: orderId }] });
    }

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

    const formattedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : item.status;
    const resolvedMode = deliveryMode || deliveryType || item.deliveryType || "pending_choice";

    if (status) item.status = formattedStatus;
    if (deliveryType || deliveryMode) item.deliveryType = resolvedMode;

    const sellerInfo = await resolveSellerProfileDetails(req, order);
    item.sellerDetails = sellerInfo;
    item.storeName = sellerInfo.storeName;
    item.sellerName = sellerInfo.sellerName;
    item.sellerPhone = sellerInfo.phone;

    if (selfDeliveryDetails) {
      const clientAppUrl = (process.env.CLIENT_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, '');
      const tokenVal = String(
        selfDeliveryDetails.deliveryPartnerToken ||
        item.selfDeliveryDetails?.deliveryPartnerToken ||
        `DLV-${Math.floor(100000 + Math.random() * 900000)}`
      ).trim();
      const trackingLink = `${clientAppUrl}/#delivery-partner?token=${encodeURIComponent(tokenVal)}`;
      const otpVal = selfDeliveryDetails.deliveryOtp || item.selfDeliveryDetails?.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();

      item.selfDeliveryDetails = {
        ...item.selfDeliveryDetails,
        ...selfDeliveryDetails,
        deliveryPartnerToken: tokenVal,
        trackingUrl: trackingLink,
        deliveryOtp: otpVal
      };
    }

    if (thirdPartyDetails) {
      const carrierUrl = thirdPartyDetails.trackingUrl || resolveCarrierTrackingUrl(thirdPartyDetails.courierName, thirdPartyDetails.trackingNumber);
      item.thirdPartyDetails = {
        ...item.thirdPartyDetails,
        ...thirdPartyDetails,
        trackingUrl: carrierUrl
      };
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: formattedStatus.toLowerCase(),
      title: `Item '${item.name}' ${formattedStatus}`,
      description: `Item status updated to ${formattedStatus} by seller (${sellerInfo.storeName}).`,
      timestamp: new Date(),
      updatedBy: sellerInfo.storeName || "Seller"
    });

    await order.save();

    res.json({
      message: `Item status updated to ${formattedStatus}`,
      item
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

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: orderId }, { id: orderId }] });
    }

    if (!order) return res.status(404).json({ message: "Order not found" });

    const formattedStatus = status
      ? normalizeOrderStatus(status)
      : normalizeOrderStatus(order.status || "Pending");

    const sellerInfo = await resolveSellerProfileDetails(req, order);
    order.sellerDetails = sellerInfo;

    const resolvedMode = deliveryMode || deliveryType || (selfDeliveryDetails ? "self_delivery" : (courierName || trackingNumber ? "third_party" : (order.deliveryMode || "")));
    order.deliveryMode = resolvedMode;

    let computedTrackingUrl = trackingUrl || "";
    if (resolvedMode === "third_party") {
      if (courierName) order.courierName = courierName;
      let effectiveAwb = trackingNumber || order.trackingNumber || "";
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

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        if (status) item.status = formattedStatus;
        item.deliveryType = resolvedMode;
        item.sellerDetails = sellerInfo;
        item.sellerName = sellerInfo.sellerName;
        item.storeName = sellerInfo.storeName;
        item.sellerPhone = sellerInfo.phone;

        if (resolvedMode === "third_party") {
          item.thirdPartyDetails = {
            ...item.thirdPartyDetails,
            courierName: courierName || item.thirdPartyDetails?.courierName || order.courierName,
            trackingNumber: trackingNumber || item.thirdPartyDetails?.trackingNumber || order.trackingNumber,
            trackingUrl: computedTrackingUrl || item.thirdPartyDetails?.trackingUrl,
            estimatedDeliveryDate: estimatedDeliveryDate || item.thirdPartyDetails?.estimatedDeliveryDate
          };
        } else if (resolvedMode === "self_delivery" && mergedSelf) {
          item.selfDeliveryDetails = mergedSelf;
        }
      });
    }

    if (status) {
      order.status = formattedStatus;
      order.overallStatus = formattedStatus;
    }

    if (status) {
      order.timeline = order.timeline || [];
      const deliveryDesc = resolvedMode === "self_delivery"
        ? `Direct Self-Delivery by ${sellerInfo.storeName} ${mergedSelf?.deliveryPersonName ? `(Rider: ${mergedSelf.deliveryPersonName})` : ''}`
        : (trackingNumber ? `Courier: ${courierName || order.courierName || 'Express'} (AWB: ${trackingNumber})` : 'Dispatched via Courier');

      order.timeline.push({
        status: formattedStatus,
        title: `Order ${formattedStatus}`,
        description: `Status updated to ${formattedStatus} by seller (${sellerInfo.storeName}). ${deliveryDesc}`,
        timestamp: new Date(),
        updatedBy: sellerInfo.storeName || "Seller"
      });
    }

    await order.save();
    res.json({ success: true, message: `Order status updated to ${formattedStatus}`, order });
  } catch (error) {
    res.status(500).json({ message: "Failed to update order status", error: error.message });
  }
};

// 5. Download Seller Tax Invoice / Packing Slip
export const downloadSellerInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = resolveSellerId(req);

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId)
        .populate("items.productId", "name price images mrp")
        .populate("items.sellerId", "storeName name phone city");
    }
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: orderId }, { id: orderId }] })
        .populate("items.productId", "name price images mrp")
        .populate("items.sellerId", "storeName name phone city");
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // STRICT CONFIRMATION CHECK: Certificate/Invoice only generated when order is confirmed
    const status = String(order.overallStatus || order.status || "").toLowerCase().trim();
    const confirmedStatuses = [
      "confirmed",
      "packed",
      "shipped",
      "out_for_delivery",
      "out for delivery",
      "delivered",
      "completed"
    ];

    if (!confirmedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Tax Invoice & Certificate can only be generated strictly after the order is confirmed."
      });
    }

    const { generateTaxInvoicePDF } = await import("../services/invoiceService.js");

    const orderObj = order.toObject ? order.toObject() : order;
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([orderObj]))[0];

    // STRICT PAYMENT STATUS VERIFICATION CHECK: Seller Invoice only created after payment status is verified & confirmed ("paid")
    const paymentStatus = String(enrichedOrder.paymentStatus || "").toLowerCase().trim();
    if (paymentStatus !== "paid") {
      return res.status(400).json({
        message: `Tax Invoice cannot be created until payment status is verified and confirmed. Current payment status: ${enrichedOrder.paymentStatus || "pending"}.`
      });
    }

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
