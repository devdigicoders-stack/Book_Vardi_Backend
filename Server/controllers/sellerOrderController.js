import Order from "../models/Order.js";

// Get All Orders for the Logged-in Seller
export const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user.id;

    // Find all orders containing at least one item from this seller
    const orders = await Order.find({
      "items.sellerId": sellerId
    }).sort({ createdAt: -1 });

    // Format orders to highlight this seller's items and earnings
    const sellerOrders = orders.map((order) => {
      const sellerItems = order.items.filter(
        (item) => item.sellerId && item.sellerId.toString() === sellerId
      );

      const sellerSubtotal = sellerItems.reduce(
        (acc, item) => acc + (item.total || item.finalPrice * item.quantity),
        0
      );

      return {
        _id: order._id,
        orderId: order.orderId,
        customer: order.customer,
        shippingAddress: order.shippingAddress || order.address,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: sellerItems,
        sellerSubtotal
      };
    });

    res.json(sellerOrders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller orders", error: error.message });
  }
};

// Get Dynamic Customer & Parent Records for Logged-in Seller
export const getSellerCustomers = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const orders = await Order.find({ "items.sellerId": sellerId }).sort({ createdAt: -1 });

    const customerMap = new Map();

    orders.forEach(order => {
      const c = order.customer || {};
      const key = (c.phone || c.email || c.name || "Customer").toLowerCase().trim();
      if (!key) return;

      const sellerItems = order.items.filter(
        (item) => item.sellerId && item.sellerId.toString() === sellerId
      );
      const sellerSubtotal = sellerItems.reduce(
        (acc, item) => acc + (item.total || (item.finalPrice || item.price || 0) * item.quantity),
        0
      );

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: `CUST-${Math.floor(10000 + Math.random() * 90000)}`,
          name: c.name || "Valued Parent / Customer",
          email: c.email || "",
          phone: c.phone || "",
          schoolAffiliation: order.school || c.school || "General Public",
          studentName: c.studentName || order.studentName || "",
          totalOrders: 1,
          totalSpend: sellerSubtotal,
          status: sellerSubtotal >= 5000 ? "VIP" : "Active",
          lastOrderDate: order.createdAt
        });
      } else {
        const existing = customerMap.get(key);
        existing.totalOrders += 1;
        existing.totalSpend += sellerSubtotal;
        if (existing.totalSpend >= 5000) existing.status = "VIP";
      }
    });

    res.json(Array.from(customerMap.values()));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customer list", error: error.message });
  }
};

// Update Order Item Status & Delivery Method by Seller (Self-Delivery vs Third-Party)
export const updateSellerOrderItemStatus = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const {
      status,
      deliveryType, // 'self_delivery' | 'third_party'
      selfDeliveryDetails, // { deliveryPersonName, deliveryPersonPhone, vehicleNumber }
      thirdPartyDetails // { courierName, trackingNumber, trackingUrl, estimatedDeliveryDate }
    } = req.body;
    const sellerId = req.user.id;

    const allowedStatuses = ["pending", "processing", "packed", "shipped", "delivered", "cancelled"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}`
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Order item not found" });
    }

    // Ensure item belongs to this seller
    if (!item.sellerId || item.sellerId.toString() !== sellerId) {
      return res.status(403).json({ message: "Unauthorized to update this item" });
    }

    if (status) item.status = status;
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

    await order.save();

    res.json({
      message: `Item status updated to ${status || item.status} (Fulfillment: ${item.deliveryType})`,
      item
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update item delivery & status", error: error.message });
  }
};

// Update Overall Order Status for Seller Order
export const updateSellerOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingNumber, courierName } = req.body;
    const sellerId = req.user.id;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Update matching items
    order.items.forEach(item => {
      if (item.sellerId && item.sellerId.toString() === sellerId) {
        if (status) item.status = status;
        if (trackingNumber || courierName) {
          item.thirdPartyDetails = {
            ...item.thirdPartyDetails,
            courierName: courierName || item.thirdPartyDetails?.courierName,
            trackingNumber: trackingNumber || item.thirdPartyDetails?.trackingNumber
          };
        }
      }
    });

    if (status) order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;

    await order.save();
    res.json({ success: true, message: "Order status updated successfully", order });
  } catch (error) {
    res.status(500).json({ message: "Failed to update order status", error: error.message });
  }
};


// 3. Download Seller Tax Invoice / Packing Slip (Only includes this seller's products)
export const downloadSellerInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const sellerId = req.user.id;

    const order = await Order.findById(orderId)
      .populate("items.productId", "name price images mrp")
      .populate("items.sellerId", "storeName name phone city");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const hasSellerItems = order.items.some(
      (item) => item.sellerId && item.sellerId._id?.toString() === sellerId.toString()
    );

    if (!hasSellerItems) {
      return res.status(403).json({ message: "No items in this order belong to your store" });
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

