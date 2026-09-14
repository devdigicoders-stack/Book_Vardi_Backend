import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
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

// 1. Get all orders (Admin / General)
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.productId", "name price images mrp")
      .populate("items.sellerId", "storeName name phone")
      .sort({ createdAt: -1 });
    res.json(orders);
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

    const formattedOrders = orders.map((ord) => ({
      id: ord.id || ord.orderId || ord._id,
      date: ord.date || new Date(ord.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: ord.overallStatus || ord.status || 'Processing',
      trackingNumber: ord.trackingNumber || `BLUEDART-${Math.floor(10000000 + Math.random() * 90000000)}`,
      itemsCount: ord.items?.reduce((s, it) => s + (it.quantity || 1), 0) || ord.quantity || 1,
      items: ord.items || [],
      subtotal: ord.subtotal || ord.totalAmount || ord.total || 0,
      shippingCost: ord.shippingCost !== undefined ? ord.shippingCost : (ord.shippingFee || 0),
      shippingFee: ord.shippingFee !== undefined ? ord.shippingFee : (ord.shippingCost || 0),
      discount: ord.discount || ord.discountAmount || 0,
      total: ord.total || ord.totalAmount || 0,
      shippingAddress: ord.shippingAddress || { street: ord.address || '' },
      paymentMethod: ord.paymentMethod || 'UPI',
      estimatedDelivery: ord.estimatedDelivery || '3-5 Business Days'
    }));

    return res.json(formattedOrders);
  } catch (error) {
    console.warn("⚠️ [GET /api/orders/my-orders] DB connection unavailable:", error.message);
    return res.json([]);
  }
};

// 3. Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.productId", "name price images mrp")
      .populate("items.sellerId", "storeName name phone");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
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
    const resolvedPhone = user?.phone || req.headers["x-user-phone"] || customer?.phone || req.body.phone || "";
    const resolvedEmail = user?.email || customer?.email || req.body.email || "";
    const resolvedName = user?.name || customer?.name || req.body.customer || "Student";

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

    const orderIdVal = id || orderId || `SC-${Math.floor(1000 + Math.random() * 9000)}`;

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
      paymentStatus: "paid",
      overallStatus: "Processing",
      status: "Processing",
      trackingNumber: trackingNumber || `BLUEDART-${Math.floor(10000000 + Math.random() * 90000000)}`,
      address: typeof shippingAddress === "string" ? shippingAddress : (address || shippingAddress?.street || ""),
      product: product || (orderItems[0]?.name || ""),
      quantity: quantity || (orderItems[0]?.quantity || 1),
      amount: calculatedTotal
    });

    await newOrder.save();

    return res.status(201).json({ message: "Order placed successfully in DB", order: newOrder });
  } catch (error) {
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

    const currentStatus = order.overallStatus;
    const currentStepIndex = standardSteps.findIndex((s) => s.key === currentStatus);

    const trackingSummary = {
      orderId: order.orderId,
      orderDbId: order._id,
      createdAt: order.createdAt,
      estimatedDeliveryDate: order.estimatedDeliveryDate,
      currentStatus: order.overallStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress || { street: order.address },
      totalAmount: order.totalAmount,
      isCancelled: order.overallStatus === "cancelled",
      isDelivered: order.overallStatus === "delivered",
      currentStepIndex: currentStepIndex > -1 ? currentStepIndex : (currentStatus === "processing" ? 1 : 0),
      steps: standardSteps.map((step, idx) => ({
        ...step,
        isCompleted: currentStepIndex >= idx,
        isCurrent: currentStepIndex === idx
      })),
      timeline: order.timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      items: order.items.map((item) => ({
        id: item._id,
        name: item.name,
        quantity: item.quantity,
        price: item.finalPrice || item.price,
        size: item.size,
        age: item.age,
        deliveryType: item.deliveryType,
        deliveryOtp: item.selfDeliveryDetails?.deliveryOtp,
        selfDelivery: item.selfDeliveryDetails,
        thirdParty: item.thirdPartyDetails,
        itemStatus: item.status
      }))
    };

    res.json(trackingSummary);
  } catch (error) {
    res.status(500).json({ message: "Failed to track order", error: error.message });
  }
};

// 6. Update Order Status (Admin / Seller / System) with Timeline Push
export const updateOrder = async (req, res) => {
  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    const previousStatus = existingOrder.overallStatus;
    const newStatus = req.body.overallStatus || req.body.status;
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
      returned: { title: "Order Returned", desc: "Order return processed." }
    };

    if (newStatus && newStatus !== previousStatus) {
      existingOrder.overallStatus = newStatus;
      existingOrder.status = newStatus;

      // Restock if cancelled
      if (newStatus === "cancelled" && previousStatus !== "cancelled") {
        for (const item of existingOrder.items) {
          if (item.productId) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { stock: item.quantity || 1 }
            });
          }
        }
        if (cancellationReason) existingOrder.cancellationReason = cancellationReason;
      }

      // If order is delivered, credit seller wallet balance after deducting platform commission
      if (newStatus === "delivered" && previousStatus !== "delivered") {
        const Seller = (await import("../models/Seller.js")).default;
        for (const item of existingOrder.items) {
          if (item.sellerId) {
            const seller = await Seller.findById(item.sellerId);
            if (seller) {
              const itemTotal = item.total || (item.finalPrice || item.price) * (item.quantity || 1);
              const commissionRate = seller.commissionPercentage !== undefined ? seller.commissionPercentage : 5;
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
      const statusMeta = statusTextMap[newStatus] || {
        title: `Status: ${newStatus}`,
        desc: "Order status updated."
      };

      const updatedByRole = req.user?.role
        ? req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)
        : "Admin";

      existingOrder.timeline.push({
        status: newStatus,
        title: statusTitle || statusMeta.title,
        description: statusDescription || statusMeta.desc,
        location: statusLocation || "",
        timestamp: new Date(),
        updatedBy: updatedByRole
      });
    }

    if (paymentStatus) existingOrder.paymentStatus = paymentStatus;
    if (estimatedDeliveryDate) existingOrder.estimatedDeliveryDate = new Date(estimatedDeliveryDate);

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
    const order = await Order.findById(req.params.id)
      .populate("items.productId", "name price images mrp")
      .populate("items.sellerId", "storeName name phone city");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Access control: User who placed order, Admin, or Seller involved in order
    if (req.user) {
      const isOwner = order.userId && order.userId.toString() === req.user.id;
      const isAdmin = req.user.role === "admin";
      const isSeller =
        req.user.role === "seller" &&
        order.items.some(
          (item) => item.sellerId && item.sellerId._id?.toString() === req.user.id
        );

      if (!isOwner && !isAdmin && !isSeller) {
        return res.status(403).json({ message: "Not authorized to download this invoice" });
      }
    }

    const { generateTaxInvoicePDF } = await import("../services/invoiceService.js");

    const filename = `Invoice_${order.orderId || order._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generateTaxInvoicePDF(order);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({ message: "Failed to generate invoice", error: error.message });
  }
};