import Order from "../models/Order.js";
import Product from "../models/Product.js";

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
    const orders = await Order.find({ userId: req.user.id })
      .populate("items.productId", "name price images mrp")
      .populate("items.sellerId", "storeName name phone")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch my orders", error: error.message });
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
    const {
      customer,
      items,
      shippingAddress,
      paymentMethod,
      totalAmount,
      product,
      quantity,
      amount,
      size,
      age,
      color,
      address
    } = req.body;

    const userId = req.user ? req.user.id : req.body.userId || null;

    // Handle both multi-item structure and single item legacy payload
    let orderItems = items || [];
    let calculatedTotal = totalAmount;

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

    // Helper function: calculate distance in KM between two coordinates using Haversine formula
    const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
      if (!lat1 || !lon1 || !lat2 || !lon2) return null;
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    };

    const customerLat = req.body.customerLat || req.body.latitude || shippingAddress?.latitude || null;
    const customerLng = req.body.customerLng || req.body.longitude || shippingAddress?.longitude || null;

    // Step A: Stock Validation & Pre-deduction check + Seller Delivery capability analysis
    for (const item of orderItems) {
      if (item.productId) {
        const prod = await Product.findById(item.productId).populate("sellerId");
        if (prod) {
          if (prod.stock < (item.quantity || 1)) {
            return res.status(400).json({
              message: `Insufficient stock for product '${prod.name}'. Only ${prod.stock} left in stock.`
            });
          }
          if (prod.sellerId && !item.sellerId) {
            item.sellerId = prod.sellerId._id;
          }

          // Calculate distance & delivery type option
          const sellerObj = prod.sellerId;
          if (sellerObj && sellerObj.location?.latitude && customerLat && customerLng) {
            const dist = calculateDistanceKm(
              customerLat,
              customerLng,
              sellerObj.location.latitude,
              sellerObj.location.longitude
            );
            item.distanceFromSellerKm = dist;
            const maxRadius = sellerObj.deliveryPreferences?.maxDeliveryRadiusKm || 10;
            const canSelfDeliver = sellerObj.deliveryPreferences?.selfDelivery !== false && dist <= maxRadius;

            item.deliveryRadiusKm = maxRadius;
            item.deliveryType = canSelfDeliver ? "self_delivery" : "third_party";
          } else if (sellerObj) {
            item.deliveryRadiusKm = sellerObj.deliveryPreferences?.maxDeliveryRadiusKm || 10;
            item.deliveryType = sellerObj.deliveryPreferences?.selfDelivery !== false ? "self_delivery" : "third_party";
          }
        }
      }
    }

    // Step B: Deduct Stock atomically
    for (const item of orderItems) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -(item.quantity || 1) }
        });
      }
    }

    const order = new Order({
      userId: userId,
      customer: customer || {
        name: req.body.customer || (req.user ? req.user.name : "Customer"),
        email: req.user ? req.user.email : req.body.email || "",
        phone: req.body.phone || (req.user ? req.user.phone : "")
      },
      items: orderItems,
      totalAmount: calculatedTotal || amount || 0,
      shippingAddress: shippingAddress || { street: address || "" },
      paymentMethod: paymentMethod || "COD",
      address: address || "",
      product: product || (orderItems[0]?.name || ""),
      quantity: quantity || (orderItems[0]?.quantity || 1),
      amount: amount || calculatedTotal || 0
    });

    await order.save();
    res.status(201).json({ message: "Order placed successfully", order });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(400).json({ message: "Failed to create order", error: error.message });
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