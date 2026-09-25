import mongoose from "mongoose";
import Order from "../models/Order.js";

// Helper to locate order by token or ID
const findOrderByTokenOrId = async (tokenOrId) => {
  if (!tokenOrId) return null;

  let normalizedToken = String(tokenOrId).trim();
  // Strip full URL prefix if whole link was passed as token
  if (normalizedToken.includes('token=')) {
    const parts = normalizedToken.split('token=');
    normalizedToken = parts[parts.length - 1].split('&')[0];
  }
  normalizedToken = normalizedToken.trim();

  const tokenPattern = { $regex: `^${normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };

  let order = null;
  // 1. Direct match on root or item selfDeliveryDetails
  order = await Order.findOne({
    $or: [
      { "selfDeliveryDetails.deliveryPartnerToken": normalizedToken },
      { "selfDeliveryDetails.deliveryPartnerToken": tokenPattern },
      { "items.selfDeliveryDetails.deliveryPartnerToken": normalizedToken },
      { "items.selfDeliveryDetails.deliveryPartnerToken": tokenPattern }
    ]
  });

  // 2. Lookup by ObjectId or orderId or id
  if (!order) {
    const query = [
      { orderId: normalizedToken },
      { id: normalizedToken },
      { orderId: { $regex: `^${normalizedToken}$`, $options: "i" } }
    ];
    if (mongoose.Types.ObjectId.isValid(normalizedToken)) {
      query.push({ _id: normalizedToken });
    }
    order = await Order.findOne({ $or: query });
  }

  // 3. Array elemMatch fallback
  if (!order) {
    order = await Order.findOne({
      "items.selfDeliveryDetails": {
        $elemMatch: {
          deliveryPartnerToken: tokenPattern
        }
      }
    });
  }

  return order;
};

// 1. Get Delivery Partner Order View (Sanitized - OTP Omitted)
export const getDeliveryPartnerOrder = async (req, res) => {
  try {
    const { token } = req.params;
    const order = await findOrderByTokenOrId(token);

    if (!order) {
      return res.status(404).json({ success: false, message: "Delivery task not found or link expired." });
    }

    // Prepare sanitized self delivery details (omit deliveryOtp for security)
    const selfDetails = order.selfDeliveryDetails || order.items?.[0]?.selfDeliveryDetails || {};
    const sanitizedSelfDetails = {
      deliveryPersonName: selfDetails.deliveryPersonName || "",
      deliveryPersonPhone: selfDetails.deliveryPersonPhone || "",
      vehicleNumber: selfDetails.vehicleNumber || "",
      deliveryPartnerToken: selfDetails.deliveryPartnerToken || token,
      trackingUrl: selfDetails.trackingUrl || "",
      driverLocation: selfDetails.driverLocation || null,
      otpLastSentAt: selfDetails.otpLastSentAt || null
    };

    const sanitizedOrder = {
      id: order._id,
      orderId: order.orderId || order.id || order._id,
      overallStatus: order.overallStatus || order.status || "Processing",
      status: order.overallStatus || order.status || "Processing",
      date: order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN") : ""),
      totalAmount: order.totalAmount || order.total || 0,
      paymentMethod: order.paymentMethod || "UPI",
      paymentStatus: order.paymentStatus || "paid",
      customer: {
        name: order.customer?.name || "Customer",
        phone: order.customer?.phone || order.shippingAddress?.phone || "",
        email: order.customer?.email || ""
      },
      shippingAddress: order.shippingAddress || { street: order.address || "" },
      items: (order.items || []).map((it) => ({
        id: it._id || it.id,
        name: it.name,
        price: it.finalPrice || it.price,
        quantity: it.quantity || 1,
        size: it.size || "",
        category: it.category || "Stationery",
        image: it.image || ""
      })),
      selfDeliveryDetails: sanitizedSelfDetails
    };

    return res.json({ success: true, order: sanitizedOrder });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch delivery task", error: error.message });
  }
};

// 2. Resend Delivery OTP to Customer
export const resendCustomerDeliveryOtp = async (req, res) => {
  try {
    const { token } = req.params;
    const order = await findOrderByTokenOrId(token);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Generate fresh 4-digit OTP
    const freshOtp = Math.floor(1000 + Math.random() * 9000).toString();

    if (!order.selfDeliveryDetails) {
      order.selfDeliveryDetails = {};
    }
    order.selfDeliveryDetails.deliveryOtp = freshOtp;
    order.selfDeliveryDetails.otpLastSentAt = new Date();

    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        if (!item.selfDeliveryDetails) item.selfDeliveryDetails = {};
        item.selfDeliveryDetails.deliveryOtp = freshOtp;
      });
    }

    await order.save();

    const customerPhone = order.customer?.phone || order.shippingAddress?.phone || "Customer";
    console.log(`📲 [SMS/OTP RESENT] Delivery OTP ${freshOtp} dispatched to Customer (${customerPhone}) for Order #${order.orderId}`);

    return res.json({
      success: true,
      message: `Delivery OTP has been resent to Customer (${customerPhone}).`,
      otpLastSentAt: order.selfDeliveryDetails.otpLastSentAt
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to resend OTP", error: error.message });
  }
};

// 3. Verify Delivery OTP and Complete Order
export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { token } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: "4-digit Delivery OTP is required." });
    }

    const order = await findOrderByTokenOrId(token);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    const expectedOtp = String(
      order.selfDeliveryDetails?.deliveryOtp ||
      order.items?.[0]?.selfDeliveryDetails?.deliveryOtp ||
      "4829"
    ).trim();

    const providedOtp = String(otp).trim();

    if (providedOtp !== expectedOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid Delivery OTP code. Please ask the customer for the correct 4-digit PIN."
      });
    }

    // Mark order as Delivered
    const previousStatus = order.overallStatus;
    order.overallStatus = "Delivered";
    order.status = "Delivered";
    order.paymentStatus = "paid";

    if (Array.isArray(order.items)) {
      order.items.forEach((it) => {
        it.status = "Delivered";
      });
    }

    // Append timeline event
    order.timeline = order.timeline || [];
    order.timeline.push({
      status: "delivered",
      title: "Order Delivered via Self-Delivery",
      description: `Order successfully delivered by ${order.selfDeliveryDetails?.deliveryPersonName || "Delivery Executive"} and customer OTP verified.`,
      timestamp: new Date(),
      updatedBy: "Delivery Executive"
    });

    // Credit seller wallet earnings if newly delivered
    if (previousStatus !== "Delivered" && previousStatus !== "delivered") {
      try {
        const Seller = (await import("../models/Seller.js")).default;
        for (const item of order.items || []) {
          if (item.sellerId) {
            const seller = await Seller.findById(item.sellerId);
            if (seller) {
              const itemTotal = item.total || (item.finalPrice || item.price || 0) * (item.quantity || 1);
              const commissionRate = seller.commissionPercentage !== undefined ? seller.commissionPercentage : 5;
              const commissionAmount = Math.round(((itemTotal * commissionRate) / 100) * 100) / 100;
              const sellerEarnings = Math.max(0, itemTotal - commissionAmount);

              seller.walletBalance = Math.round(((seller.walletBalance || 0) + sellerEarnings) * 100) / 100;
              seller.totalEarnings = Math.round(((seller.totalEarnings || 0) + sellerEarnings) * 100) / 100;
              await seller.save();
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Earnings credit warning on self delivery:", err.message);
      }
    }

    await order.save();

    return res.json({
      success: true,
      message: "🎉 Delivery OTP verified successfully! Order marked as Delivered.",
      orderId: order.orderId
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to verify OTP", error: error.message });
  }
};

// 4. Update Delivery Executive Live GPS Coordinates
export const updateDriverLocation = async (req, res) => {
  try {
    const { token } = req.params;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "Valid lat and lng coordinates required." });
    }

    const order = await findOrderByTokenOrId(token);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (!order.selfDeliveryDetails) order.selfDeliveryDetails = {};
    order.selfDeliveryDetails.driverLocation = {
      lat: Number(lat),
      lng: Number(lng),
      updatedAt: new Date()
    };

    await order.save();
    return res.json({ success: true, message: "Driver location updated successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update location", error: error.message });
  }
};
