import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Kit from "../models/Kit.js";
import User from "../models/User.js";
import Seller from "../models/Seller.js";
import mongoose from "mongoose";

// Helper to locate user document by ID, email, or phone
const findUserByIdentifier = async (req) => {
  const userId = req.user?.id || req.user?._id || req.body?.userId;
  const userPhone = req.user?.phone || req.headers?.["x-user-phone"] || req.body?.userPhone || req.body?.phone || req.body?.customer?.phone;
  const userEmail = req.user?.email || req.body?.userEmail || req.body?.email || req.body?.customer?.email;

  const query = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    query.push({ _id: userId });
  }
  if (userPhone) {
    const cleanPhone = String(userPhone).replace(/\D/g, "");
    if (cleanPhone.length >= 10) {
      query.push({ phone: { $regex: cleanPhone.slice(-10) + "$" } });
    } else {
      query.push({ phone: String(userPhone).trim() });
    }
  }
  if (userEmail) {
    query.push({ email: String(userEmail).toLowerCase().trim() });
  }

  if (query.length === 0) return null;
  return await User.findOne({ $or: query });
};

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

// Helper to safely locate a Product document without throwing CastError on non-ObjectId search IDs
const findProductByIdOrCustomId = async (searchId) => {
  if (!searchId) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(searchId)) {
      const prod = await Product.findById(searchId);
      if (prod) return prod;
    }
    return await Product.findOne({ id: searchId });
  } catch (err) {
    return null;
  }
};

// Helper to safely locate a Kit document without throwing CastError on non-ObjectId search IDs
const findKitByIdOrCustomId = async (searchId) => {
  if (!searchId) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(searchId)) {
      const kit = await Kit.findById(searchId);
      if (kit) return kit;
    }
    return await Kit.findOne({ id: searchId });
  } catch (err) {
    return null;
  }
};

export const isPlaceholderCust = (str) => {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim().toLowerCase();
  return (
    s === '' ||
    s === 'student' ||
    s === 'student customer' ||
    s === 'customer' ||
    s === 'valued customer' ||
    s === 'verified customer' ||
    s === 'test student' ||
    s === 'avatar upload tester' ||
    s === 'user' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'n/a'
  );
};

export const isPlaceholderSeller = (str) => {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim().toLowerCase();
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
    s === 'n/a'
  );
};

// Helper to safely decrement stock and size variant stock for a product or kit on order placement
const decrementItemStock = async (item) => {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const searchId = item.productId || item.id || item._id;
  const itemSize = String(item.size || item.selectedSize || "").trim();

  let prod = await findProductByIdOrCustomId(searchId);
  if (!prod && item.name) {
    const cleanItemName = item.name.replace(/\s*\([^)]*\)/g, "").trim();
    prod = await Product.findOne({
      name: { $regex: new RegExp(cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    });
  }

  if (prod) {
    // 1. Decrement top level stock floor at 0
    const currentStock = Number(prod.stockQuantity ?? prod.stock ?? 0);
    const newStock = Math.max(0, currentStock - qty);
    prod.stock = newStock;
    prod.stockQuantity = newStock;

    // 2. Decrement sizeVariants stock if size specified
    if (itemSize && Array.isArray(prod.sizeVariants) && prod.sizeVariants.length > 0) {
      const variant = prod.sizeVariants.find(
        (v) => String(v.size || v.measureValue || "").trim().toLowerCase() === itemSize.toLowerCase()
      );
      if (variant) {
        const vStock = Number(variant.stockQuantity ?? variant.stock ?? 0);
        const vNewStock = Math.max(0, vStock - qty);
        variant.stock = vNewStock;
        variant.stockQuantity = vNewStock;
      }
    }

    // 3. Update out-of-stock status if stock reaches 0
    if (prod.stock <= 0) {
      prod.status = "out-of-stock";
      prod.inStock = false;
    }

    await prod.save();
  }

  // Also handle Kit document stock
  let kit = await findKitByIdOrCustomId(searchId);
  if (!kit && item.name) {
    const cleanItemName = item.name.replace(/\s*\([^)]*\)/g, "").trim();
    kit = await Kit.findOne({
      title: { $regex: new RegExp(cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    });
  }

  if (kit) {
    kit.stock = Math.max(0, (Number(kit.stock) || 0) - qty);
    await kit.save();
  }
};

// Helper to safely restore stock and size variant stock on order cancellation or product return
const incrementItemStock = async (item) => {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const searchId = item.productId || item.id || item._id;
  const itemSize = String(item.size || item.selectedSize || "").trim();

  let prod = await findProductByIdOrCustomId(searchId);
  if (!prod && item.name) {
    const cleanItemName = item.name.replace(/\s*\([^)]*\)/g, "").trim();
    prod = await Product.findOne({
      name: { $regex: new RegExp(cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    });
  }

  if (prod) {
    // 1. Restore top level stock
    const currentStock = Number(prod.stockQuantity ?? prod.stock ?? 0);
    const newStock = currentStock + qty;
    prod.stock = newStock;
    prod.stockQuantity = newStock;

    // 2. Restore sizeVariants stock if size specified
    if (itemSize && Array.isArray(prod.sizeVariants) && prod.sizeVariants.length > 0) {
      const variant = prod.sizeVariants.find(
        (v) => String(v.size || v.measureValue || "").trim().toLowerCase() === itemSize.toLowerCase()
      );
      if (variant) {
        const vStock = Number(variant.stockQuantity ?? variant.stock ?? 0);
        const vNewStock = vStock + qty;
        variant.stock = vNewStock;
        variant.stockQuantity = vNewStock;
      }
    }

    // 3. Reset status to active if stock > 0
    if (prod.stock > 0) {
      if (prod.status === "out-of-stock") prod.status = "active";
      prod.inStock = true;
    }

    await prod.save();
  }

  // Also handle Kit document stock
  let kit = await findKitByIdOrCustomId(searchId);
  if (!kit && item.name) {
    const cleanItemName = item.name.replace(/\s*\([^)]*\)/g, "").trim();
    kit = await Kit.findOne({
      title: { $regex: new RegExp(cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    });
  }

  if (kit) {
    kit.stock = (Number(kit.stock) || 0) + qty;
    await kit.save();
  }
};

// Helper to enrich orders with real seller and real consumer details
export const enrichOrdersWithSellerAndConsumer = async (orders) => {
  if (!orders) return orders;
  const isArray = Array.isArray(orders);
  const orderList = isArray ? orders : [orders];
  if (orderList.length === 0) return orders;

  try {
    const sellerIds = new Set();
    const userIds = new Set();
    const productIds = new Set();

    orderList.forEach(ord => {
      if (ord.userId) {
        const uId = ord.userId._id ? ord.userId._id.toString() : ord.userId.toString();
        if (mongoose.Types.ObjectId.isValid(uId)) userIds.add(uId);
      }
      if (ord.sellerDetails?.sellerId) {
        const sId = ord.sellerDetails.sellerId.toString();
        if (mongoose.Types.ObjectId.isValid(sId)) sellerIds.add(sId);
      }
      (ord.items || []).forEach(item => {
        if (item.sellerId) {
          const sId = item.sellerId._id ? item.sellerId._id.toString() : item.sellerId.toString();
          if (mongoose.Types.ObjectId.isValid(sId)) sellerIds.add(sId);
        }
        if (item.productId) {
          const pId = item.productId._id ? item.productId._id.toString() : item.productId.toString();
          if (mongoose.Types.ObjectId.isValid(pId)) productIds.add(pId);
        }
      });
    });

    const sellers = sellerIds.size > 0 
      ? await Seller.find({ _id: { $in: Array.from(sellerIds) } }).lean()
      : [];

    const sellerMap = new Map();
    sellers.forEach(s => {
      sellerMap.set(s._id.toString(), {
        sellerId: s._id,
        storeName: s.storeName || s.name,
        sellerName: s.name || s.storeName,
        name: s.name,
        phone: s.phone || "",
        email: s.email || "",
        address: s.address || "",
        city: s.city || "",
        state: s.state || "",
        pincode: s.pincode || "",
        gstNumber: s.gstNumber || ""
      });
    });

    // Check User collection for seller IDs that might be users
    const remainingSellerIds = Array.from(sellerIds).filter(id => !sellerMap.has(id));
    if (remainingSellerIds.length > 0) {
      const sellerUsers = await User.find({ _id: { $in: remainingSellerIds } }).lean();
      sellerUsers.forEach(u => {
        sellerMap.set(u._id.toString(), {
          sellerId: u._id,
          storeName: u.storeName || u.name,
          sellerName: u.name || u.storeName,
          name: u.name,
          phone: u.phone || "",
          email: u.email || "",
          address: u.address || "",
          city: u.city || "",
          state: u.state || "",
          pincode: u.pincode || "",
          gstNumber: ""
        });
      });
    }

    // Check Products for items with unknown sellers
    const productMap = new Map();
    if (productIds.size > 0) {
      const prods = await Product.find({ _id: { $in: Array.from(productIds) } }).lean();
      prods.forEach(p => {
        productMap.set(p._id.toString(), p);
        if (p.sellerId && !sellerMap.has(p.sellerId.toString())) {
          sellerIds.add(p.sellerId.toString());
        }
      });
      // Fetch any newly discovered sellerIds from products
      const newSellerIds = Array.from(sellerIds).filter(id => !sellerMap.has(id));
      if (newSellerIds.length > 0) {
        const extraSellers = await Seller.find({ _id: { $in: newSellerIds } }).lean();
        extraSellers.forEach(s => {
          sellerMap.set(s._id.toString(), {
            sellerId: s._id,
            storeName: s.storeName || s.name,
            sellerName: s.name || s.storeName,
            name: s.name,
            phone: s.phone || "",
            email: s.email || "",
            address: s.address || "",
            city: s.city || "",
            state: s.state || "",
            pincode: s.pincode || "",
            gstNumber: s.gstNumber || ""
          });
        });
      }
    }

    // Lookup users for consumer details
    const userMap = new Map();
    if (userIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(userIds) } }).lean();
      users.forEach(u => userMap.set(u._id.toString(), u));
    }

    orderList.forEach(ord => {
      const uId = ord.userId ? (ord.userId._id ? ord.userId._id.toString() : ord.userId.toString()) : null;
      const userDoc = uId ? userMap.get(uId) : null;
      const rawAddr = (ord.shippingAddress && typeof ord.shippingAddress === 'object') ? ord.shippingAddress : {};

      // 1. Resolve Consumer Details
      const candNames = [
        rawAddr.name,
        rawAddr.fullName,
        rawAddr.recipientName,
        userDoc?.name,
        ord.customer?.name,
        ord.customerName
      ].filter(n => n && !isPlaceholderCust(n));

      const realName = candNames[0] || (userDoc && !isPlaceholderCust(userDoc.name) ? userDoc.name : "Verified Consumer");

      const realPhone = rawAddr.phone || rawAddr.mobile || ord.customer?.phone || userDoc?.phone || ord.phone || "";
      const realEmail = ord.customer?.email || rawAddr.email || userDoc?.email || ord.email || "";

      // Hydrate address from user profile if order shipping address is missing
      if (!rawAddr.street && !rawAddr.addressLine && userDoc?.addresses && userDoc.addresses.length > 0) {
        const uAddr = userDoc.addresses.find(a => a.isDefault) || userDoc.addresses[0];
        if (uAddr) {
          rawAddr.name = rawAddr.name || uAddr.name || realName;
          rawAddr.phone = rawAddr.phone || uAddr.phone || realPhone;
          rawAddr.addressLine = uAddr.addressLine || uAddr.street;
          rawAddr.street = uAddr.street || uAddr.addressLine;
          rawAddr.city = uAddr.city;
          rawAddr.state = uAddr.state;
          rawAddr.pincode = uAddr.pincode;
          rawAddr.landmark = uAddr.landmark;
          ord.shippingAddress = rawAddr;
          ord.address = [uAddr.addressLine, uAddr.street, uAddr.city, uAddr.state].filter(Boolean).join(', ') + (uAddr.pincode ? ` - ${uAddr.pincode}` : '');
        }
      }

      if (!ord.customer) ord.customer = {};
      ord.customer.name = realName;
      if (realPhone) ord.customer.phone = realPhone;
      if (realEmail) ord.customer.email = realEmail;

      ord.customerName = realName;
      ord.customerPhone = realPhone;
      ord.customerEmail = realEmail;

      // 2. Resolve Seller Details
      let primarySellerDetails = null;

      (ord.items || []).forEach(item => {
        const sId = item.sellerId ? (item.sellerId._id ? item.sellerId._id.toString() : item.sellerId.toString()) : null;
        let matchedSeller = sId ? sellerMap.get(sId) : null;

        if (!matchedSeller && item.productId) {
          const pId = item.productId._id ? item.productId._id.toString() : item.productId.toString();
          const pDoc = productMap.get(pId);
          if (pDoc) {
            const pSellerId = pDoc.sellerId ? pDoc.sellerId.toString() : null;
            if (pSellerId && sellerMap.has(pSellerId)) {
              matchedSeller = sellerMap.get(pSellerId);
            } else if (pDoc.sellerStoreName || pDoc.storeName) {
              matchedSeller = {
                sellerId: pDoc.sellerId,
                storeName: pDoc.sellerStoreName || pDoc.storeName,
                sellerName: pDoc.sellerName || pDoc.sellerStoreName || pDoc.storeName,
                name: pDoc.sellerName || "",
                phone: "",
                email: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                gstNumber: ""
              };
            }
          }
        }

        if (matchedSeller) {
          item.sellerId = matchedSeller;
          item.sellerName = matchedSeller.storeName || matchedSeller.name;
          item.storeName = matchedSeller.storeName;
          item.sellerPhone = matchedSeller.phone;
          item.sellerEmail = matchedSeller.email;
          item.sellerAddress = matchedSeller.address;
          item.sellerCity = matchedSeller.city;
          item.sellerState = matchedSeller.state;
          item.sellerDetails = matchedSeller;
          if (!primarySellerDetails) primarySellerDetails = matchedSeller;
        } else if (item.sellerDetails && !isPlaceholderSeller(item.sellerDetails.storeName)) {
          if (!primarySellerDetails) primarySellerDetails = item.sellerDetails;
        } else if (!isPlaceholderSeller(item.sellerName || item.storeName)) {
          const sName = item.sellerName || item.storeName;
          if (!primarySellerDetails) {
            primarySellerDetails = {
              storeName: sName,
              sellerName: sName,
              phone: item.sellerPhone || "",
              city: item.sellerCity || ""
            };
          }
        }
      });

      if (primarySellerDetails) {
        if (!ord.sellerDetails || isPlaceholderSeller(ord.sellerDetails.storeName)) {
          ord.sellerDetails = primarySellerDetails;
        }
        ord.sellerName = primarySellerDetails.storeName || primarySellerDetails.sellerName;
        ord.sellerStoreName = primarySellerDetails.storeName;
        ord.sellerPhone = primarySellerDetails.phone;
        ord.sellerCity = primarySellerDetails.city;
      }

      // Canonicalize status across overall order and individual items
      ord.overallStatus = normalizeOrderStatus(ord.overallStatus || ord.status);
      ord.status = ord.overallStatus;
      if (ord.items && Array.isArray(ord.items)) {
        ord.items.forEach(item => {
          item.status = normalizeOrderStatus(item.status || ord.overallStatus);
        });
      }
    });

  } catch (err) {
    console.warn("⚠️ [enrichOrdersWithSellerAndConsumer] Error:", err.message);
  }

  return isArray ? orderList : orderList[0];
};

// 1. Get all orders (Admin / General)
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "name email phone addresses")
      .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
      .sort({ createdAt: -1 })
      .lean();
    const enrichedOrders = await enrichOrdersWithSellerAndConsumer(orders);
    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
};

// 2. Get User's Own Orders
export const getMyOrders = async (req, res) => {
  try {
    const user = await findUserByIdentifier(req);
    const userPhone = req.headers["x-user-phone"] || req.query.phone || req.query.userPhone || user?.phone;
    const userEmail = req.query.email || req.query.userEmail || user?.email;

    const query = [];
    if (user && user._id) {
      query.push({ userId: user._id });
    }
    if (req.user && req.user.id) {
      query.push({ userId: req.user.id });
    }
    if (userPhone) {
      const cleanPhone = String(userPhone).replace(/\D/g, "");
      if (cleanPhone.length >= 10) {
        const last10 = cleanPhone.slice(-10);
        query.push({ "customer.phone": { $regex: last10 + "$" } });
        query.push({ "shippingAddress.phone": { $regex: last10 + "$" } });
      } else {
        query.push({ "customer.phone": String(userPhone).trim() });
      }
    }
    if (userEmail && String(userEmail).trim()) {
      query.push({ "customer.email": String(userEmail).toLowerCase().trim() });
    }

    let orders = [];
    if (query.length > 0) {
      orders = await Order.find({ $or: query }).sort({ createdAt: -1 });
    }

    const formattedOrders = orders.map((ord) => {
      const canonicalStatus = normalizeOrderStatus(ord.overallStatus || ord.status || 'Processing');
      const isSelfDelivery = ord.deliveryMode === 'self_delivery' ||
        Boolean(ord.selfDeliveryDetails?.deliveryPartnerToken) ||
        ord.items?.some(it => it.deliveryType === 'self' || it.deliveryType === 'self_delivery' || it.selfDeliveryDetails?.deliveryPartnerToken);

      const resolvedDeliveryMode = isSelfDelivery ? 'self_delivery' : (ord.deliveryMode || (ord.courierName || ord.trackingNumber ? 'third_party' : ''));

      const firstItem = ord.items?.[0] || {};
      const resolvedSellerDetails = ord.sellerDetails && ord.sellerDetails.storeName ? ord.sellerDetails : (firstItem.sellerDetails || {
        sellerId: firstItem.sellerId || ord.sellerId,
        storeName: firstItem.storeName || firstItem.sellerName || "Partner Merchant",
        sellerName: firstItem.sellerName || firstItem.storeName || "Partner Merchant",
        phone: firstItem.sellerPhone || ord.sellerPhone || "",
        email: firstItem.sellerEmail || ord.sellerEmail || "",
        address: firstItem.sellerAddress || ord.sellerAddress || "",
        city: firstItem.sellerCity || ord.sellerCity || ""
      });

      const formattedItems = (ord.items || []).map((it) => {
        const itemSelfDelivery = it.selfDeliveryDetails || ord.selfDeliveryDetails || null;
        const itemThirdParty = it.thirdPartyDetails || {
          courierName: ord.courierName || "",
          trackingNumber: ord.trackingNumber || "",
          trackingUrl: ord.trackingUrl || ""
        };
        const itemSellerDetails = it.sellerDetails || {
          sellerId: it.sellerId,
          storeName: it.storeName || it.sellerName || resolvedSellerDetails.storeName,
          sellerName: it.sellerName || it.storeName || resolvedSellerDetails.sellerName,
          phone: it.sellerPhone || resolvedSellerDetails.phone || "",
          email: it.sellerEmail || resolvedSellerDetails.email || "",
          address: it.sellerAddress || resolvedSellerDetails.address || "",
          city: it.sellerCity || resolvedSellerDetails.city || ""
        };

        return {
          id: it._id || it.id,
          _id: it._id || it.id,
          name: it.name,
          price: it.finalPrice || it.price,
          quantity: it.quantity || 1,
          size: it.size || "",
          color: it.color || "",
          image: it.image || "",
          category: it.category || "Stationery",
          deliveryType: it.deliveryType || resolvedDeliveryMode || "pending_choice",
          sellerId: it.sellerId,
          sellerName: it.sellerName || itemSellerDetails.sellerName,
          storeName: it.storeName || itemSellerDetails.storeName,
          sellerPhone: it.sellerPhone || itemSellerDetails.phone,
          sellerDetails: itemSellerDetails,
          selfDeliveryDetails: itemSelfDelivery,
          thirdPartyDetails: itemThirdParty,
          status: normalizeOrderStatus(it.status || canonicalStatus)
        };
      });

      return {
        id: ord.id || ord.orderId || ord._id,
        orderId: ord.orderId || ord.id || ord._id,
        date: ord.date || new Date(ord.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: canonicalStatus,
        overallStatus: canonicalStatus,
        deliveryMode: resolvedDeliveryMode,
        courierName: ord.courierName || ord.carrier || firstItem.thirdPartyDetails?.courierName || '',
        carrier: ord.carrier || ord.courierName || '',
        trackingNumber: ord.trackingNumber || firstItem.thirdPartyDetails?.trackingNumber || '',
        trackingUrl: ord.trackingUrl || firstItem.thirdPartyDetails?.trackingUrl || '',
        sellerDetails: resolvedSellerDetails,
        selfDeliveryDetails: ord.selfDeliveryDetails || firstItem.selfDeliveryDetails || null,
        itemsCount: ord.items?.reduce((s, it) => s + (it.quantity || 1), 0) || ord.quantity || 1,
        items: formattedItems,
        subtotal: ord.subtotal || ord.totalAmount || ord.total || 0,
        shippingCost: ord.shippingCost !== undefined ? ord.shippingCost : (ord.shippingFee || 0),
        shippingFee: ord.shippingFee !== undefined ? ord.shippingFee : (ord.shippingCost || 0),
        discount: ord.discount || ord.discountAmount || 0,
        total: ord.total || ord.totalAmount || 0,
        shippingAddress: ord.shippingAddress || { street: ord.address || '' },
        paymentMethod: ord.paymentMethod || 'UPI',
        paymentStatus: ord.paymentStatus || 'paid',
        estimatedDelivery: ord.estimatedDelivery || '3-5 Business Days',
        cancellationReason: ord.cancellationReason || '',
        cancelledBy: ord.cancelledBy || '',
        cancelledAt: ord.cancelledAt || null,
        refundStatus: ord.refundStatus || ''
      };
    });

    return res.json(formattedOrders);
  } catch (error) {
    console.warn("⚠️ [GET /api/orders/my-orders] DB connection unavailable:", error.message);
    return res.json([]);
  }
};

// 3. Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    let order = isMongoId
      ? await Order.findById(id)
          .populate("userId", "name email phone addresses")
          .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
          .lean()
      : null;
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: id }, { id: id }] })
        .populate("userId", "name email phone addresses")
        .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
        .lean();
    }
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([order]))[0];
    res.json(enrichedOrder);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch order", error: error.message });
  }
};

// 4. Create new order with Stock Validation & Auto-Deduction
export const createOrder = async (req, res) => {
  try {
    const user = await findUserByIdentifier(req);

    const {
      id,
      orderId,
      customer,
      items,
      shippingAddress,
      paymentMethod,
      totalAmount,
      total,
      subtotal,
      shippingCost,
      shippingFee,
      discount,
      discountAmount,
      trackingNumber,
      date,
      product,
      quantity,
      amount,
      size,
      age,
      color,
      address
    } = req.body;

    const resolvedUserId = user ? user._id : (req.user ? req.user.id : req.body.userId || null);
    const resolvedPhone = shippingAddress?.phone || user?.phone || req.headers["x-user-phone"] || customer?.phone || req.body.phone || "";
    const resolvedEmail = shippingAddress?.email || user?.email || customer?.email || req.body.email || "";
    const resolvedName = (shippingAddress && !isPlaceholderCust(shippingAddress.name || shippingAddress.fullName) && (shippingAddress.name || shippingAddress.fullName)) ||
      (!isPlaceholderCust(customer?.name) && customer?.name) ||
      (!isPlaceholderCust(user?.name) && user?.name) ||
      (!isPlaceholderCust(req.body.customerName) && req.body.customerName) ||
      (!isPlaceholderCust(req.body.customer) && req.body.customer) ||
      (shippingAddress?.name || shippingAddress?.fullName || customer?.name || user?.name || "Verified Consumer");

    let orderItems = items || [];
    let calculatedTotal = totalAmount || total || amount || 0;

    if ((!orderItems || orderItems.length === 0) && product) {
      orderItems = [
        {
          name: product,
          price: amount || 0,
          finalPrice: amount || 0,
          quantity: quantity || 1,
          size: size || "",
          age: age || "",
          color: color || "",
          total: (amount || 0) * (quantity || 1),
          status: "pending"
        }
      ];
      calculatedTotal = (amount || 0) * (quantity || 1);
    }

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: "Cannot place order with empty items" });
    }

    // Auto-populate productId, sellerId, sellerName, storeName, and GST on order items from Product & User collections
    for (const item of orderItems) {
      const searchId = item.productId || item.id || item._id;
      let prod = await findProductByIdOrCustomId(searchId);
      if (!prod && item.name) {
        const cleanItemName = item.name.replace(/\s*\([^)]*\)/g, "").trim();
        prod = await Product.findOne({
          name: { $regex: new RegExp(cleanItemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
        });
      }

      let sellerStoreName = item.sellerName || item.storeName || item.sellerStoreName || "";

      const isPlaceholder = (str) => {
        if (!str || typeof str !== "string") return true;
        const s = str.trim().toLowerCase();
        return (
          s === "" ||
          s === "bookvardimerchant" ||
          s === "bookvardi merchant" ||
          s === "book vardi partner merchant" ||
          s === "partner merchant" ||
          s === "unknown seller" ||
          s === "new merchant" ||
          s === "merchant store" ||
          s === "n/a"
        );
      };

      if (isPlaceholder(sellerStoreName)) {
        sellerStoreName = "";
      }

      if (prod) {
        if (!item.productId) item.productId = prod._id;
        if (!item.id) item.id = prod._id;
        if (!item.sellerId && prod.sellerId) item.sellerId = prod.sellerId;
        if (!item.image && prod.images && prod.images.length > 0) item.image = prod.images[0];
        if (!sellerStoreName && prod.sellerStoreName && !isPlaceholder(prod.sellerStoreName)) sellerStoreName = prod.sellerStoreName;
        if (!sellerStoreName && prod.storeName && !isPlaceholder(prod.storeName)) sellerStoreName = prod.storeName;
        if (!sellerStoreName && prod.sellerName && !isPlaceholder(prod.sellerName)) sellerStoreName = prod.sellerName;
        if (!sellerStoreName && prod.legalBusinessName && !isPlaceholder(prod.legalBusinessName)) sellerStoreName = prod.legalBusinessName;
      }

      let sellerPhone = item.sellerPhone || "";
      let sellerEmail = item.sellerEmail || "";
      let sellerAddress = item.sellerAddress || "";
      let sellerCity = item.sellerCity || "";

      if (!sellerStoreName && item.sellerId) {
        try {
          let sellerUser = null;
          if (mongoose.Types.ObjectId.isValid(item.sellerId)) {
            sellerUser = await User.findById(item.sellerId);
          }
          if (!sellerUser && typeof item.sellerId === "string") {
            sellerUser = await User.findOne({ $or: [{ id: item.sellerId }, { phone: item.sellerId }, { email: item.sellerId }] });
          }
          if (!sellerUser) {
            const SellerModel = (await import("../models/Seller.js")).default;
            sellerUser = await SellerModel.findById(item.sellerId).catch(() => null);
          }
          if (sellerUser) {
            const fetchedName = sellerUser.storeName || sellerUser.name || sellerUser.legalName || sellerUser.ownerFullName || "";
            if (!isPlaceholder(fetchedName)) {
              sellerStoreName = fetchedName;
            }
            if (!sellerPhone) sellerPhone = sellerUser.phone || sellerUser.mobile || "";
            if (!sellerEmail) sellerEmail = sellerUser.email || "";
            if (!sellerAddress) sellerAddress = sellerUser.address || sellerUser.addressLine1 || sellerUser.registeredAddress || "";
            if (!sellerCity) sellerCity = sellerUser.city || "";
          }
        } catch (e) {}
      }

      if (!sellerStoreName) {
        sellerStoreName = "BookVardi Verified Seller";
      }

      item.sellerName = sellerStoreName;
      item.storeName = sellerStoreName;
      item.sellerPhone = sellerPhone;
      item.sellerEmail = sellerEmail;
      item.sellerAddress = sellerAddress;
      item.sellerCity = sellerCity;
      item.sellerDetails = {
        sellerId: item.sellerId,
        storeName: sellerStoreName,
        sellerName: sellerStoreName,
        phone: sellerPhone,
        email: sellerEmail,
        address: sellerAddress,
        city: sellerCity
      };

      // Attach dynamic seller commission rate
      let itemCommRate = item.commissionRate ?? item.sellerCommissionRate ?? item.commissionPercentage;
      if (itemCommRate === undefined || itemCommRate === null || isNaN(Number(itemCommRate))) {
        if (prod && (prod.commissionRate !== undefined || prod.sellerCommissionRate !== undefined)) {
          itemCommRate = prod.commissionRate ?? prod.sellerCommissionRate;
        }
      }
      if ((itemCommRate === undefined || itemCommRate === null || isNaN(Number(itemCommRate))) && item.sellerId) {
        try {
          let sUser = await User.findById(item.sellerId).catch(() => null);
          if (!sUser && typeof item.sellerId === "string") {
            sUser = await User.findOne({ $or: [{ id: item.sellerId }, { phone: item.sellerId }, { email: item.sellerId }] }).catch(() => null);
          }
          if (sUser && (sUser.commissionRate !== undefined || sUser.commissionPercentage !== undefined)) {
            itemCommRate = sUser.commissionRate ?? sUser.commissionPercentage;
          }
        } catch (e) {}
      }
      const resolvedCommRate = (itemCommRate !== undefined && itemCommRate !== null && !isNaN(Number(itemCommRate))) ? Number(itemCommRate) : 8;
      item.commissionRate = resolvedCommRate;
      item.sellerCommissionRate = resolvedCommRate;

      // Ensure explicit product-level GST rate set by seller is strictly preserved
      const explicitGst = item.gstPercent ?? item.gstPercentage ?? item.gstRate ?? item.gst ?? item.taxRate ?? prod?.gstPercent ?? prod?.gstRate ?? prod?.gst ?? prod?.gstPercentage ?? prod?.taxRate;
      let resolvedGst = 5;
      if (explicitGst !== undefined && explicitGst !== null && String(explicitGst).trim() !== "" && !isNaN(Number(explicitGst))) {
        resolvedGst = Number(explicitGst);
      }
      item.gst = resolvedGst;
      item.gstPercent = resolvedGst;
      item.gstPercentage = resolvedGst;
      item.gstRate = resolvedGst;
    }

    const orderIdVal = id || orderId || `SC-${Math.floor(1000 + Math.random() * 9000)}`;

      const isCodOrder = paymentMethod && String(paymentMethod).toUpperCase().includes("COD");
      const initialPaymentStatus = isCodOrder ? "pending" : "paid";

      const rawDeliveryMode = req.body.deliveryMode || req.body.deliveryType || "";
      let topDeliveryMode = "pending_choice";
      if (req.body.selfDeliveryDetails) {
        topDeliveryMode = "self_delivery";
      } else if (req.body.courierName || trackingNumber) {
        topDeliveryMode = "third_party";
      } else if (["third_party", "self_delivery", "standard", "express", "pending_choice"].includes(rawDeliveryMode)) {
        topDeliveryMode = rawDeliveryMode;
      }

      const newOrder = new Order({
        orderId: orderIdVal,
        id: orderIdVal,
        userId: resolvedUserId,
        customer: customer || {
          name: resolvedName,
          email: resolvedEmail,
          phone: resolvedPhone
        },
        items: orderItems,
        subtotal: subtotal || 0,
        shippingCost: shippingCost !== undefined ? shippingCost : (shippingFee || 0),
        shippingFee: shippingFee !== undefined ? shippingFee : (shippingCost || 0),
        discount: discount || discountAmount || 0,
        discountAmount: discountAmount || discount || 0,
        totalAmount: calculatedTotal,
        total: calculatedTotal,
        date: date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        shippingAddress: shippingAddress || { street: address || "" },
        paymentMethod: paymentMethod || "UPI",
        paymentStatus: initialPaymentStatus,
        overallStatus: "Processing",
        status: "Processing",
        deliveryMode: topDeliveryMode,
        courierName: req.body.courierName || "",
        trackingNumber: trackingNumber || "",
        trackingUrl: req.body.trackingUrl || "",
        sellerDetails: req.body.sellerDetails || orderItems[0]?.sellerDetails || null,
        selfDeliveryDetails: req.body.selfDeliveryDetails || null,
        address: typeof shippingAddress === "string" ? shippingAddress : (address || shippingAddress?.street || ""),
        product: product || (orderItems[0]?.name || ""),
        quantity: quantity || (orderItems[0]?.quantity || 1),
        amount: calculatedTotal
      });

    await newOrder.save();

    // Auto-decrease product and kit stock in MongoDB as order is placed
    try {
      for (const item of orderItems) {
        await decrementItemStock(item);
      }
    } catch (stockErr) {
      console.warn("⚠️ Stock auto-decrement warning:", stockErr.message);
    }

    return res.status(201).json({ message: "Order placed successfully in DB", order: newOrder });
  } catch (error) {
    console.error("❌ [POST /api/orders] Error creating order:", error);
    return res.status(400).json({ message: "Failed to create order", error: error.message });
  }
};

// 5. Track Order API with Full Visual Timeline & Delivery Status
export const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Search by either MongoDB _id or custom orderId (e.g. SK-MTMPX58U)
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(orderId);
    const query = isMongoId ? { _id: orderId } : { orderId };

    const order = await Order.findOne(query)
      .populate("items.productId", "name price images category")
      .populate("items.sellerId", "storeName name phone address city");

    if (!order) {
      return res.status(404).json({ message: "Order not found with provided tracking identifier." });
    }

    // Standard 6-Step Visual Tracking Steps for Front-end Stepper UI
    const standardSteps = [
      { key: "placed", label: "Order Placed", stepNumber: 1 },
      { key: "confirmed", label: "Order Confirmed", stepNumber: 2 },
      { key: "packed", label: "Packed", stepNumber: 3 },
      { key: "shipped", label: "Shipped", stepNumber: 4 },
      { key: "out_for_delivery", label: "Out for Delivery", stepNumber: 5 },
      { key: "delivered", label: "Delivered", stepNumber: 6 }
    ];

    const currentStatus = (order.overallStatus || order.status || "").toLowerCase();
    const currentStepIndex = standardSteps.findIndex((s) => s.key === currentStatus);

    const isCancelled = currentStatus === "cancelled";

    const trackingSummary = {
      orderId: order.orderId,
      orderDbId: order._id,
      createdAt: order.createdAt,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      currentStatus: order.overallStatus || order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress || { street: order.address },
      totalAmount: order.totalAmount,
      isCancelled,
      trackingStatus: isCancelled ? "terminated" : "active",
      cancellationReason: order.cancellationReason || "",
      cancelledBy: order.cancelledBy || "",
      cancelledAt: order.cancelledAt || null,
      refundStatus: order.refundStatus || "",
      message: isCancelled ? "Fulfillment and shipping tracking closed due to order cancellation." : "Tracking active",
      isDelivered: currentStatus === "delivered",
      currentStepIndex: isCancelled ? -1 : (currentStepIndex > -1 ? currentStepIndex : (currentStatus === "processing" ? 1 : 0)),
      deliveryMode: order.deliveryMode || (order.selfDeliveryDetails?.deliveryPartnerToken ? "self_delivery" : (order.courierName ? "third_party" : (order.items?.[0]?.deliveryType === "self" || order.items?.[0]?.deliveryType === "self_delivery" ? "self_delivery" : ""))),
      courierName: order.courierName || order.carrier || order.items?.[0]?.thirdPartyDetails?.courierName || "",
      carrier: order.carrier || order.courierName || "",
      trackingNumber: order.trackingNumber || order.items?.[0]?.thirdPartyDetails?.trackingNumber || "",
      trackingUrl: order.trackingUrl || order.items?.[0]?.thirdPartyDetails?.trackingUrl || "",
      sellerDetails: order.sellerDetails || order.items?.[0]?.sellerDetails || (order.items?.[0]?.sellerId ? {
        storeName: order.items[0].sellerId.storeName || order.items[0].sellerName || "",
        sellerName: order.items[0].sellerName || order.items[0].sellerId.storeName || "",
        phone: order.items[0].sellerId.phone || "",
        email: order.items[0].sellerId.email || "",
        address: order.items[0].sellerId.address || order.items[0].sellerId.city || ""
      } : null),
      selfDeliveryDetails: order.selfDeliveryDetails || order.items?.[0]?.selfDeliveryDetails || null,
      steps: standardSteps.map((step, idx) => ({
        ...step,
        isCompleted: isCancelled ? false : currentStepIndex >= idx,
        isCurrent: isCancelled ? false : currentStepIndex === idx
      })),
      timeline: order.timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      items: order.items.map((item) => {
        const itemSellerDoc = item.sellerId && typeof item.sellerId === 'object' ? item.sellerId : null;
        const itemSellerDetails = item.sellerDetails || {
          sellerId: itemSellerDoc?._id || item.sellerId,
          storeName: item.storeName || item.sellerName || itemSellerDoc?.storeName || itemSellerDoc?.name || "Partner Merchant",
          sellerName: item.sellerName || item.storeName || itemSellerDoc?.name || itemSellerDoc?.storeName || "Partner Merchant",
          phone: item.sellerPhone || itemSellerDoc?.phone || "",
          email: item.sellerEmail || itemSellerDoc?.email || "",
          address: item.sellerAddress || itemSellerDoc?.address || "",
          city: item.sellerCity || itemSellerDoc?.city || ""
        };

        return {
          id: item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.finalPrice || item.price,
          size: item.size,
          age: item.age,
          color: item.color,
          image: item.image,
          deliveryType: item.deliveryType || order.deliveryMode || "pending_choice",
          deliveryOtp: item.selfDeliveryDetails?.deliveryOtp || order.selfDeliveryDetails?.deliveryOtp,
          selfDelivery: item.selfDeliveryDetails || order.selfDeliveryDetails,
          selfDeliveryDetails: item.selfDeliveryDetails || order.selfDeliveryDetails,
          thirdParty: item.thirdPartyDetails || {
            courierName: order.courierName,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl
          },
          thirdPartyDetails: item.thirdPartyDetails || {
            courierName: order.courierName,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl
          },
          sellerName: itemSellerDetails.sellerName,
          storeName: itemSellerDetails.storeName,
          sellerPhone: itemSellerDetails.phone,
          sellerDetails: itemSellerDetails,
          itemStatus: item.status
        };
      })
    };

    res.json(trackingSummary);
  } catch (error) {
    res.status(500).json({ message: "Failed to track order", error: error.message });
  }
};

// 6. Update Order Status (Admin / Seller / System) with Timeline Push
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    let existingOrder = isMongoId ? await Order.findById(id) : null;
    if (!existingOrder) {
      existingOrder = await Order.findOne({ $or: [{ orderId: id }, { id: id }] });
    }
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const previousStatus = existingOrder.overallStatus || existingOrder.status;
    const previousStatusKey = String(previousStatus || '').toLowerCase().trim().replace(/[\s-]+/g, "_");

    const rawNewStatus = req.body.overallStatus || req.body.status;
    const newStatusKey = rawNewStatus ? String(rawNewStatus).toLowerCase().trim().replace(/[\s-]+/g, "_") : null;
    const canonicalStatus = rawNewStatus ? normalizeOrderStatus(rawNewStatus) : null;

    const {
      statusTitle,
      statusDescription,
      statusLocation,
      cancellationReason,
      paymentStatus,
      estimatedDeliveryDate
    } = req.body;

    // Status Title and Description Map
    const statusTextMap = {
      placed: { title: "Order Placed", desc: "Your order has been placed successfully." },
      confirmed: { title: "Order Confirmed", desc: "Seller has confirmed your order." },
      processing: { title: "Processing Order", desc: "Order is being prepared." },
      packed: { title: "Items Packed", desc: "Items have been packed and ready for dispatch." },
      shipped: { title: "Order Shipped", desc: "Order is on the way." },
      out_for_delivery: { title: "Out for Delivery", desc: "Delivery executive is arriving at your address." },
      delivered: { title: "Delivered", desc: "Package handed over to customer." },
      cancelled: { title: "Order Cancelled", desc: cancellationReason || "Order was cancelled." },
      returned: { title: "Order Returned", desc: "Order return processed." },
      refund_requested: { title: "Refund Requested", desc: "Refund receiving details provided by customer." },
      refund_approved: { title: "Refund Approved", desc: "Admin approved refund for cancelled order." },
      refund_initiated: { title: "Refund Initiated", desc: "Refund payout initiated to customer's UPI / Bank account." },
      refund_completed: { title: "Refund Completed", desc: "Refund payout successfully credited." },
      return_requested: { title: "Return Requested", desc: "Return request submitted by customer." },
      return_approved: { title: "Return Approved", desc: "Return request approved. Doorstep pickup scheduled." },
      product_return_received: { title: "Product Return Received", desc: "Returned product received at facility and inspected." }
    };

    if (canonicalStatus && newStatusKey !== previousStatusKey) {
      existingOrder.overallStatus = canonicalStatus;
      existingOrder.status = canonicalStatus;

      // Restock item inventory on cancellation or when product return is received / completed
      const restockStatuses = ["cancelled", "returned", "product_return_received", "return_completed"];
      const isCurrentRestock = restockStatuses.includes(newStatusKey);
      const isPreviousRestock = restockStatuses.includes(previousStatusKey);

      if (isCurrentRestock && !isPreviousRestock) {
        for (const item of existingOrder.items) {
          await incrementItemStock(item);
        }
        if (cancellationReason) existingOrder.cancellationReason = cancellationReason;
      }

      // Sync sub-document statuses
      if (newStatusKey === "refund_approved") {
        existingOrder.refundStatus = "Refund Approved";
      } else if (newStatusKey === "refund_initiated") {
        existingOrder.refundStatus = "Refund Initiated";
        if (existingOrder.returnRequest) existingOrder.returnRequest.status = "refund_initiated";
      } else if (newStatusKey === "refund_completed") {
        existingOrder.paymentStatus = "refunded";
        existingOrder.refundStatus = "Refund Completed";
        if (existingOrder.returnRequest) existingOrder.returnRequest.status = "refund_completed";
      } else if (newStatusKey === "return_approved") {
        if (existingOrder.returnRequest) existingOrder.returnRequest.status = "approved";
      } else if (newStatusKey === "product_return_received" || newStatusKey === "product_received") {
        if (existingOrder.returnRequest) existingOrder.returnRequest.status = "product_received";
      }

      // If order is delivered, verify payment status for COD and credit seller wallet balance
      if (newStatusKey === "delivered" && previousStatusKey !== "delivered") {
        const isCodOrder = String(existingOrder.paymentMethod || "").toUpperCase().includes("COD") || existingOrder.paymentStatus !== "paid";
        if (isCodOrder) {
          existingOrder.paymentStatus = "paid";
          existingOrder.codCollectedAt = new Date();
          existingOrder.codCollectedBy = req.user?.name || req.body.deliveryPersonName || "Delivery Executive";
        }

        const Seller = (await import("../models/Seller.js")).default;
        for (const item of existingOrder.items) {
          if (item.sellerId) {
            const seller = await Seller.findById(item.sellerId);
            if (seller) {
              const itemTotal = item.total || (item.finalPrice || item.price) * (item.quantity || 1);
              const commissionRate = seller.commissionPercentage !== undefined ? seller.commissionPercentage : (seller.commissionRate !== undefined ? seller.commissionRate : 5);
              const commissionAmount = Math.round(((itemTotal * commissionRate) / 100) * 100) / 100;
              const sellerEarnings = Math.max(0, itemTotal - commissionAmount);

              seller.walletBalance = Math.round(((seller.walletBalance || 0) + sellerEarnings) * 100) / 100;
              seller.totalEarnings = Math.round(((seller.totalEarnings || 0) + sellerEarnings) * 100) / 100;
              await seller.save();
            }
          }
        }
      }

      // Append to timeline
      const statusMeta = statusTextMap[newStatusKey] || {
        title: `Order ${canonicalStatus}`,
        desc: `Order status updated to ${canonicalStatus}.`
      };

      const updatedByRole = req.user?.role
        ? req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)
        : "Admin";

      existingOrder.timeline.push({
        status: canonicalStatus,
        title: statusTitle || statusMeta.title,
        description: statusDescription || statusMeta.desc,
        location: statusLocation || "",
        timestamp: new Date(),
        updatedBy: updatedByRole
      });
    }

    if (req.body.refundStatus) existingOrder.refundStatus = req.body.refundStatus;
    if (paymentStatus) existingOrder.paymentStatus = paymentStatus;
    if (estimatedDeliveryDate) existingOrder.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    if (req.body.deliveryMode) existingOrder.deliveryMode = req.body.deliveryMode;
    if (req.body.courierName) existingOrder.courierName = req.body.courierName;
    if (req.body.carrier) existingOrder.carrier = req.body.carrier;
    if (req.body.trackingNumber !== undefined) existingOrder.trackingNumber = req.body.trackingNumber;
    if (req.body.trackingUrl) existingOrder.trackingUrl = req.body.trackingUrl;
    if (req.body.sellerDetails) existingOrder.sellerDetails = req.body.sellerDetails;
    if (req.body.selfDeliveryDetails) existingOrder.selfDeliveryDetails = req.body.selfDeliveryDetails;

    // Propagate status and fulfillment details to all order items
    if (existingOrder.items && Array.isArray(existingOrder.items)) {
      existingOrder.items.forEach(item => {
        if (canonicalStatus) item.status = canonicalStatus;
        if (req.body.deliveryMode) item.deliveryType = req.body.deliveryMode;
        if (req.body.courierName || req.body.trackingNumber !== undefined || req.body.trackingUrl) {
          item.thirdPartyDetails = {
            ...item.thirdPartyDetails,
            courierName: req.body.courierName || existingOrder.courierName || "",
            trackingNumber: req.body.trackingNumber !== undefined ? req.body.trackingNumber : (existingOrder.trackingNumber || ""),
            trackingUrl: req.body.trackingUrl || existingOrder.trackingUrl || ""
          };
        }
        if (req.body.selfDeliveryDetails) {
          item.selfDeliveryDetails = req.body.selfDeliveryDetails;
        }
      });
    }

    await existingOrder.save();
    res.json({ message: "Order updated successfully", order: existingOrder });
  } catch (error) {
    res.status(400).json({ message: "Failed to update order", error: error.message });
  }
};

// 7. Delete order
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete order", error: error.message });
  }
};


// 7. Download Flipkart / Amazon Style GST Tax Invoice PDF
export const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    let order = isMongoId
      ? await Order.findById(id)
          .populate("userId", "name email phone addresses")
          .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
      : null;
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: id }, { id: id }] })
        .populate("userId", "name email phone addresses")
        .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName");
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
        message: "Tax Invoice & Certificate can only be generated strictly after the order is confirmed by the seller or admin."
      });
    }

    // Access control: User who placed order, Admin, or Seller involved in order
    if (req.user) {
      const isOwner = order.userId && order.userId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin";
      const isSeller =
        req.user.role === "seller" &&
        order.items.some(
          (item) => item.sellerId && (item.sellerId._id || item.sellerId).toString() === req.user.id
        );

      if (!isOwner && !isAdmin && !isSeller) {
        return res.status(403).json({ message: "Not authorized to download this invoice" });
      }
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([orderObj]))[0];

    const orderStatusVal = String(enrichedOrder.overallStatus || enrichedOrder.status || "").toLowerCase().trim();
    const { generateTaxInvoicePDF, generateCreditNotePDF } = await import("../services/invoiceService.js");

    if (orderStatusVal === "cancelled") {
      const filename = `CreditNote_${enrichedOrder.orderId || enrichedOrder._id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const pdfDoc = generateCreditNotePDF(enrichedOrder);
      return pdfDoc.pipe(res);
    }

    const filename = `Invoice_${enrichedOrder.orderId || enrichedOrder._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateTaxInvoicePDF(enrichedOrder);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({ message: "Failed to generate invoice", error: error.message });
  }
};

// 7b. Dedicated Download Credit Note Endpoint
export const downloadCreditNote = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    let order = isMongoId
      ? await Order.findById(id)
          .populate("userId", "name email phone addresses")
          .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
      : null;
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: id }, { id: id }] })
        .populate("userId", "name email phone addresses")
        .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName");
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user) {
      const isOwner =
        order.user?.toString() === req.user.id ||
        order.userId?.toString() === req.user.id ||
        order.customer?.phone === req.user.phone ||
        order.customer?.email === req.user.email;
      const isAdmin = req.user.role === "admin";
      const isSeller =
        req.user.role === "seller" &&
        order.items.some(
          (item) => item.sellerId && (item.sellerId._id || item.sellerId).toString() === req.user.id
        );

      if (!isOwner && !isAdmin && !isSeller) {
        return res.status(403).json({ message: "Not authorized to download this credit note" });
      }
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([orderObj]))[0];

    const { generateCreditNotePDF } = await import("../services/invoiceService.js");
    const filename = `CreditNote_${enrichedOrder.orderId || enrichedOrder._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateCreditNotePDF(enrichedOrder);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Download credit note error:", error);
    res.status(500).json({ message: "Failed to generate credit note", error: error.message });
  }
};

// 7c. Dedicated Download Exchange Invoice Endpoint
export const downloadExchangeInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    let order = isMongoId
      ? await Order.findById(id)
          .populate("userId", "name email phone addresses")
          .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName")
      : null;
    if (!order) {
      order = await Order.findOne({ $or: [{ orderId: id }, { id: id }] })
        .populate("userId", "name email phone addresses")
        .populate("items.productId", "name price images mrp sellerId sellerStoreName storeName");
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user) {
      const isOwner =
        order.user?.toString() === req.user.id ||
        order.userId?.toString() === req.user.id ||
        order.customer?.phone === req.user.phone ||
        order.customer?.email === req.user.email;
      const isAdmin = req.user.role === "admin";
      const isSeller =
        req.user.role === "seller" &&
        order.items.some(
          (item) => item.sellerId && (item.sellerId._id || item.sellerId).toString() === req.user.id
        );

      if (!isOwner && !isAdmin && !isSeller) {
        return res.status(403).json({ message: "Not authorized to download this exchange invoice" });
      }
    }

    const orderObj = order.toObject ? order.toObject() : order;
    const enrichedOrder = (await enrichOrdersWithSellerAndConsumer([orderObj]))[0];

    const { generateExchangeInvoicePDF } = await import("../services/invoiceService.js");
    const filename = `ExchangeInvoice_${enrichedOrder.orderId || enrichedOrder._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateExchangeInvoicePDF(enrichedOrder);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Download exchange invoice error:", error);
    res.status(500).json({ message: "Failed to generate exchange invoice", error: error.message });
  }
};


// 8. Cancel Order Endpoint (Customer / User initiated before shipment)
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comment, refundDetails } = req.body;

    const finalReasonStr = (reason || comment || "").trim();
    if (!finalReasonStr) {
      return res.status(400).json({ message: "Cancellation reason is strictly required." });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isMongoId ? { _id: id } : { $or: [{ orderId: id }, { id: id }] };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = String(order.overallStatus || order.status || "").toLowerCase().trim();
    const cancellableStatuses = ["placed", "pending", "confirmed", "processing", "packed"];

    if (!cancellableStatuses.includes(currentStatus)) {
      return res.status(400).json({
        message: `Order cannot be cancelled because it is currently in '${order.overallStatus || order.status}' state.`
      });
    }

    const cancelledByName = req.user?.name || req.body?.cancelledBy || order.customer?.name || "Customer";

    order.overallStatus = "cancelled";
    order.status = "cancelled";
    order.cancellationReason = reason || comment || "Cancelled by customer";
    order.cancelledBy = cancelledByName;
    order.cancelledAt = new Date();

    const isPaid = String(order.paymentStatus || '').toLowerCase() === "paid" || (order.paymentMethod && !String(order.paymentMethod).toUpperCase().includes("COD"));
    
    if (isPaid) {
      if (refundDetails && (refundDetails.upiId || refundDetails.accountNumber || refundDetails.method)) {
        order.refundDetails = {
          method: refundDetails.method || (refundDetails.upiId ? "UPI" : "BANK"),
          upiId: refundDetails.upiId || "",
          bankName: refundDetails.bankName || "",
          accountNumber: refundDetails.accountNumber || "",
          ifscCode: refundDetails.ifscCode || "",
          accountHolderName: refundDetails.accountHolderName || "",
          submittedAt: new Date()
        };
      }
      order.refundStatus = "Refund Requested";
    } else {
      order.refundStatus = "N/A (Unpaid COD Order)";
      order.paymentStatus = "cancelled";
    }

    // Restock item inventory in DB
    try {
      for (const item of order.items) {
        await incrementItemStock(item);
      }
    } catch (stockErr) {
      console.warn("⚠️ Stock auto-increment warning on cancel:", stockErr.message);
    }

    // Append timeline checkpoint
    let timelineDesc = `Order cancelled by customer (${cancelledByName}). Reason: ${order.cancellationReason}`;
    if (isPaid) {
      const modeStr = order.refundDetails?.method === "UPI" ? `UPI (${order.refundDetails.upiId})` : (order.refundDetails?.method === "BANK" ? `Bank Transfer (${order.refundDetails.bankName})` : "Submitted Details");
      timelineDesc += ` • Online refund requested via ${modeStr}.`;
    }

    order.timeline.push({
      status: "cancelled",
      title: isPaid ? "Order Cancelled & Refund Requested" : "Order Cancelled",
      description: timelineDesc,
      timestamp: new Date(),
      updatedBy: "Customer"
    });


    await order.save();
    return res.json({ success: true, message: "Order cancelled successfully", order });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel order", error: error.message });
  }
};

// 9. Request Return or Exchange Endpoint (Customer / User initiated within return window)
export const requestReturnExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type, // "return" | "exchange"
      reason,
      comment,
      exchangeSize,
      exchangeColor,
      refundMethod,
      refundDetails
    } = req.body;

    if (!type || !["return", "exchange"].includes(type)) {
      return res.status(400).json({ message: "Request type must be either 'return' or 'exchange'" });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isMongoId ? { _id: id } : { $or: [{ orderId: id }, { id: id }] };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = String(order.overallStatus || order.status || "").toLowerCase().trim();
    if (currentStatus !== "delivered" && currentStatus !== "completed") {
      return res.status(400).json({ message: "Return or Exchange is only available for delivered orders." });
    }

    // Check product return window days, returnability, and exchangability
    let returnWindowDays = 7;
    let isReturnable = true;
    let isRefundable = true;
    let isExchangeable = true;

    if (order.items && order.items.length > 0) {
      const firstItem = order.items[0];
      const searchId = firstItem.productId || firstItem.id;
      if (searchId) {
        const prod = await findProductByIdOrCustomId(searchId);
        if (prod) {
          if (prod.isReturnable === false) isReturnable = false;
          if (prod.isRefundable === false) isRefundable = false;
          if (prod.isExchangeable === false) isExchangeable = false;
          if (prod.returnWindowDays && Number(prod.returnWindowDays) > 0) {
            returnWindowDays = Number(prod.returnWindowDays);
          }
        }
      }
    }

    if (type === "return" && !isReturnable) {
      return res.status(400).json({ message: "This product is marked as non-returnable." });
    }
    if (type === "refund" && !isRefundable) {
      return res.status(400).json({ message: "This product is marked as non-refundable." });
    }
    if (type === "exchange" && !isExchangeable) {
      return res.status(400).json({ message: "This product is marked as non-exchangeable." });
    }

    const deliveredDate = order.deliveredAt || new Date(order.updatedAt || order.createdAt);
    const returnEligibleUntil = new Date(deliveredDate.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);

    if (new Date() > returnEligibleUntil) {
      return res.status(400).json({
        message: `Return/Exchange window of ${returnWindowDays} days expired on ${returnEligibleUntil.toLocaleDateString('en-IN')}.`
      });
    }

    const formattedRefundDetails = refundDetails ? {
      method: refundDetails.method || (refundDetails.upiId ? "UPI" : "BANK"),
      upiId: refundDetails.upiId || "",
      bankName: refundDetails.bankName || "",
      accountNumber: refundDetails.accountNumber || "",
      ifscCode: refundDetails.ifscCode || "",
      accountHolderName: refundDetails.accountHolderName || ""
    } : { method: "", upiId: "", bankName: "", accountNumber: "", ifscCode: "", accountHolderName: "" };

    const newOverallStatus = type === "exchange" ? "exchange_requested" : "return_requested";
    order.overallStatus = newOverallStatus;
    order.status = newOverallStatus;

    const itemStatus = type === "exchange" ? "Exchange Requested" : "Return Requested";
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        item.status = itemStatus;
      });
    }

    if (type === "return") {
      order.refundDetails = {
        ...formattedRefundDetails,
        submittedAt: new Date()
      };
      order.refundStatus = "Refund Requested";
    }

    order.returnRequest = {
      type,
      reason: reason || "Customer request",
      comment: comment || "",
      exchangeSize: exchangeSize || "",
      exchangeColor: exchangeColor || "",
      refundMethod: refundMethod || "Original Payment Method",
      refundDetails: formattedRefundDetails,
      requestedAt: new Date(),
      updatedAt: new Date(),
      status: "requested",
      returnEligibleUntil
    };

    let timelineDesc = `Customer requested ${type}. Reason: ${reason || 'N/A'}${exchangeSize ? ` (Requested Size: ${exchangeSize})` : ''}`;
    if (type === "return" && formattedRefundDetails.method) {
      const modeStr = formattedRefundDetails.method === "UPI" ? `UPI (${formattedRefundDetails.upiId})` : `Bank (${formattedRefundDetails.bankName})`;
      timelineDesc += ` • Receiving account: ${modeStr}.`;
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: newOverallStatus,
      title: type === "exchange" ? "Exchange Requested" : "Return Requested",
      description: timelineDesc,
      timestamp: new Date(),
      updatedBy: "Customer"
    });

    await order.save();
    return res.json({
      success: true,
      message: `${type === 'exchange' ? 'Exchange' : 'Return'} request submitted successfully`,
      order
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit return/exchange request", error: error.message });
  }
};

// 10. Update Return/Exchange Request Status (Admin / Seller Action)
export const updateReturnExchangeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status, // "approved", "rejected", "pickup_scheduled", "product_received", "refund_initiated", "refund_processed", "refund_completed", "exchange_dispatched", "exchanged"
      rejectionReason,
      pickupDate,
      refundTxnId,
      exchangeAwb,
      exchangeCourier,
      notes
    } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
    const query = isMongoId ? { _id: id } : { $or: [{ orderId: id }, { id: id }] };
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.returnRequest || !order.returnRequest.type) {
      return res.status(400).json({ message: "No active Return or Exchange request found for this order." });
    }

    const type = order.returnRequest.type; // "return" or "exchange"
    const formattedStatus = status.toLowerCase().trim();

    order.returnRequest.status = formattedStatus;
    order.returnRequest.updatedAt = new Date();

    if (rejectionReason) order.returnRequest.rejectionReason = rejectionReason;
    if (pickupDate) order.returnRequest.pickupDate = new Date(pickupDate);
    if (refundTxnId) order.returnRequest.refundTxnId = refundTxnId;
    if (exchangeAwb) order.returnRequest.exchangeAwb = exchangeAwb;
    if (exchangeCourier) order.returnRequest.exchangeCourier = exchangeCourier;

    let overallStatus = order.overallStatus;
    let title = "";
    let description = notes || "";

    switch (formattedStatus) {
      case "approved":
        overallStatus = type === "exchange" ? "exchange_approved" : "return_approved";
        title = type === "exchange" ? "Exchange Request Approved" : "Return Request Approved";
        description = description || `Merchant/Admin approved the ${type} request. Pickup will be arranged.`;
        break;

      case "rejected":
        overallStatus = type === "exchange" ? "exchange_rejected" : "return_rejected";
        title = type === "exchange" ? "Exchange Request Rejected" : "Return Request Rejected";
        description = description || `Request rejected. Reason: ${rejectionReason || "Criteria not met"}`;
        break;

      case "pickup_scheduled":
        overallStatus = "pickup_scheduled";
        title = "Return Pickup Scheduled";
        description = description || `Pickup scheduled for ${pickupDate ? new Date(pickupDate).toLocaleDateString('en-IN') : 'upcoming business days'}.`;
        break;

      case "product_received":
        overallStatus = "product_received";
        title = "Returned Item Received & Inspected";
        description = description || `Item received back at merchant warehouse and passed quality inspection.`;
        
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            try {
              await incrementItemStock(item);
            } catch (err) {
              console.warn("Stock restoration warning:", err.message);
            }
          }
        }
        break;

      case "refund_initiated":
      case "refund_processed":
      case "refund_completed":
        overallStatus = "refund_completed";
        order.paymentStatus = "refunded";
        order.refundStatus = "Refund Completed";
        if (refundTxnId) order.refundDetails = { ...order.refundDetails, refundTxnId, status: "Completed" };
        title = "Refund Processed & Completed";
        description = description || `Refund successfully processed. Reference TXN: ${refundTxnId || "N/A"}.`;

        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            try {
              await incrementItemStock(item);
            } catch (err) {}
          }
        }
        break;

      case "exchange_dispatched":
        overallStatus = "exchange_dispatched";
        title = "Replacement Exchange Unit Dispatched";
        description = description || `Replacement item dispatched via ${exchangeCourier || "Courier"} (AWB: ${exchangeAwb || "N/A"}).`;
        break;

      case "exchanged":
        overallStatus = "exchanged";
        title = "Exchange Completed";
        description = description || `Exchange order completed and replacement delivered to customer.`;
        break;

      default:
        overallStatus = formattedStatus;
        title = `Return/Exchange Status: ${formattedStatus}`;
    }

    order.overallStatus = overallStatus;
    order.status = overallStatus;

    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        item.status = title;
      });
    }

    order.timeline = order.timeline || [];
    order.timeline.push({
      status: overallStatus,
      title,
      description,
      timestamp: new Date(),
      updatedBy: req.seller?.storeName || req.user?.name || "Store Admin"
    });

    await order.save();

    return res.json({
      success: true,
      message: `Return/Exchange status updated to ${formattedStatus}`,
      order
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update return/exchange status", error: error.message });
  }
};