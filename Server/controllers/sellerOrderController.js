import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import User from "../models/User.js";

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

    const queryScope = [...validScopeObjectIds, ...strExpandedSellerIds];

    const sellerProducts = await Product.find({
      $or: [
        { sellerId: { $in: queryScope } },
        { seller: { $in: queryScope } },
        { userId: { $in: queryScope } },
        { createdBy: { $in: queryScope } }
      ]
    }).select("_id id name title");

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

    const filter = {
      $or: [
        { "items.sellerId": { $in: queryScope } },
        { "items.seller": { $in: queryScope } },
        { "items.sellerPhone": { $in: queryScope } },
        { "items.sellerEmail": { $in: queryScope } },
        { "items.storeName": { $in: queryScope } },
        { sellerId: { $in: queryScope } },
        { seller: { $in: queryScope } },
        ...(allProductKeys.length > 0
          ? [
              { "items.productId": { $in: allProductKeys } },
              { "items.id": { $in: allProductKeys } },
              { "items._id": { $in: allProductKeys } }
            ]
          : [])
      ]
    };

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

      const rawStatus = (o.overallStatus || o.status || "Pending").toLowerCase();
      const formattedStatus =
        rawStatus === "delivered" || rawStatus === "completed" ? "Delivered" :
        rawStatus === "shipped" ? "Shipped" :
        rawStatus === "packed" ? "Packed" :
        rawStatus === "confirmed" ? "Confirmed" :
        rawStatus === "cancelled" ? "Cancelled" :
        "Pending";

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
        paymentMethod: o.paymentMethod || "UPI",
        paymentStatus: o.paymentStatus || "Paid",
        shippingAddress: typeof o.shippingAddress === "string"
          ? o.shippingAddress
          : (o.shippingAddress?.street ? `${o.shippingAddress.street}, ${o.shippingAddress.city || ""}` : "Customer Address"),
        trackingNumber: o.trackingNumber || `TRACK-${Math.floor(100000 + Math.random() * 900000)}`,
        courierName: o.courierName || "Delhivery",
        items: orderItems.map((item) => ({
          id: item._id || item.id,
          _id: item._id || item.id,
          name: item.name || "Product Item",
          price: Number(item.price || item.finalPrice || 0),
          quantity: Number(item.quantity || 1),
          total: Number(item.total || (item.price * item.quantity) || 0),
          size: item.size || "",
          color: item.color || "",
          image: item.image || ""
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

// 3. Update Order Item Status & Delivery Method by Seller
export const updateSellerOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const {
      status,
      deliveryType,
      selfDeliveryDetails,
      thirdPartyDetails
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

    if (status) item.status = formattedStatus;
    if (deliveryType) item.deliveryType = deliveryType;

    if (selfDeliveryDetails) {
      item.selfDeliveryDetails = {
        ...item.selfDeliveryDetails,
        ...selfDeliveryDetails
      };
    }

    if (thirdPartyDetails) {
      item.thirdPartyDetails = {
        ...item.thirdPartyDetails,
        ...thirdPartyDetails
      };
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: formattedStatus.toLowerCase(),
      title: `Item '${item.name}' ${formattedStatus}`,
      description: `Item status updated to ${formattedStatus} by seller.`,
      timestamp: new Date(),
      updatedBy: "Seller"
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
    const { status, trackingNumber, courierName, trackingUrl, estimatedDeliveryDate, deliveryType, selfDeliveryDetails } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: orderId }, { id: orderId }] });
    }

    if (!order) return res.status(404).json({ message: "Order not found" });

    const formattedStatus = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : (order.status || "Pending");

    if (order.items && Array.isArray(order.items)) {
      order.items.forEach(item => {
        if (status) item.status = formattedStatus;
        if (deliveryType) item.deliveryType = deliveryType;
        if (trackingNumber || courierName || trackingUrl || estimatedDeliveryDate) {
          item.thirdPartyDetails = {
            ...item.thirdPartyDetails,
            courierName: courierName || item.thirdPartyDetails?.courierName,
            trackingNumber: trackingNumber || item.thirdPartyDetails?.trackingNumber,
            trackingUrl: trackingUrl || item.thirdPartyDetails?.trackingUrl,
            estimatedDeliveryDate: estimatedDeliveryDate || item.thirdPartyDetails?.estimatedDeliveryDate
          };
        }
        if (selfDeliveryDetails) {
          const tokenVal = String(order.selfDeliveryDetails?.deliveryPartnerToken || item.selfDeliveryDetails?.deliveryPartnerToken || `DLV-${Math.floor(100000 + Math.random() * 900000)}`).trim();
          const trackingLink = `${frontendBaseUrl.replace(/\/+$/, '')}/#delivery-partner?token=${encodeURIComponent(tokenVal)}`;
          const otpVal = selfDeliveryDetails.deliveryOtp || order.selfDeliveryDetails?.deliveryOtp || item.selfDeliveryDetails?.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();

          const mergedSelf = {
            ...item.selfDeliveryDetails,
            ...selfDeliveryDetails,
            deliveryPartnerToken: tokenVal,
            trackingUrl: trackingLink,
            deliveryOtp: otpVal
          };
          item.selfDeliveryDetails = mergedSelf;
          order.selfDeliveryDetails = mergedSelf;
        }
      });
    }

    if (selfDeliveryDetails && (!order.selfDeliveryDetails || !order.selfDeliveryDetails.deliveryPartnerToken)) {
      const tokenVal = `DLV-${Math.floor(100000 + Math.random() * 900000)}`;
      const trackingLink = `${frontendBaseUrl.replace(/\/+$/, '')}/#delivery-partner?token=${encodeURIComponent(tokenVal)}`;
      const otpVal = selfDeliveryDetails.deliveryOtp || Math.floor(1000 + Math.random() * 9000).toString();
      order.selfDeliveryDetails = {
        ...order.selfDeliveryDetails,
        ...selfDeliveryDetails,
        deliveryPartnerToken: tokenVal,
        trackingUrl: trackingLink,
        deliveryOtp: otpVal
      };
    }

    if (status) {
      order.status = formattedStatus;
      order.overallStatus = formattedStatus.toLowerCase();
    }
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (courierName) order.courierName = courierName;

    if (status) {
      order.timeline = order.timeline || [];
      order.timeline.push({
        status: formattedStatus.toLowerCase(),
        title: `Order ${formattedStatus}`,
        description: `Status updated to ${formattedStatus} by seller. ${trackingNumber ? `Courier: ${courierName || 'Express'} (AWB: ${trackingNumber})` : ''}`,
        timestamp: new Date(),
        updatedBy: "Seller"
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

    const { generateTaxInvoicePDF } = await import("../services/invoiceService.js");

    const filename = `Seller_Invoice_${order.orderId || order._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateTaxInvoicePDF(order, sellerId);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Seller invoice download error:", error);
    res.status(500).json({ message: "Failed to generate seller invoice", error: error.message });
  }
};
