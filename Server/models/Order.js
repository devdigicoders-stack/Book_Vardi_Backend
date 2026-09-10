import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller"
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  size: { type: String, default: "" }, // Selected product size (e.g. "28", "30", "M", "L")
  age: { type: String, default: "" }, // Selected product age / age-group (e.g. "6-8 Years")
  color: { type: String, default: "" },
  discountPercentage: { type: Number, default: 0 },
  offerDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: function () { return this.price; } },
  quantity: { type: Number, required: true, min: 1 },
  total: { type: Number, required: true },
  // Delivery Fulfillment Options for Seller
  deliveryType: {
    type: String,
    enum: ["self_delivery", "third_party", "pending_choice"],
    default: "pending_choice"
  },
  deliveryRadiusKm: {
    type: Number,
    default: 0
  },
  distanceFromSellerKm: {
    type: Number,
    default: null
  },
  thirdPartyDetails: {
    courierName: { type: String, default: "" }, // e.g. Delhivery, Bluedart, Shiprocket
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    estimatedDeliveryDate: { type: Date, default: null }
  },
  selfDeliveryDetails: {
    deliveryPersonName: { type: String, default: "" },
    deliveryPersonPhone: { type: String, default: "" },
    vehicleNumber: { type: String, default: "" },
    deliveryOtp: { type: String, default: () => Math.floor(1000 + Math.random() * 9000).toString() }
  },
  status: {
    type: String,
    enum: ["pending", "processing", "packed", "shipped", "delivered", "cancelled"],
    default: "pending"
  }
});

const timelineEventSchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  location: {
    type: String,
    default: ""
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String, // 'User', 'Seller', 'Admin', 'DeliveryBoy', 'System'
    default: "System"
  }
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      default: () => "SK-" + Date.now().toString(36).toUpperCase()
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    customer: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" }
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    shippingAddress: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" }
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online", "Card", "UPI", "Razorpay"],
      default: "COD"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    razorpayOrderId: {
      type: String,
      default: ""
    },
    razorpayPaymentId: {
      type: String,
      default: ""
    },
    // Standard 6-Step Enterprise Status Lifecycle:
    // 1. placed -> 2. confirmed -> 3. packed -> 4. shipped -> 5. out_for_delivery -> 6. delivered (or cancelled / returned)
    overallStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned"
      ],
      default: "placed"
    },
    estimatedDeliveryDate: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Default 3 days
    },
    cancellationReason: {
      type: String,
      default: ""
    },
    // Chronological tracking timeline
    timeline: [timelineEventSchema],
    // Backwards compatibility simple fields
    address: { type: String },
    product: { type: String },
    quantity: { type: Number },
    amount: { type: Number },
    status: { type: String, default: "placed" },
    deliveryBoy: { type: String }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to initialize first timeline entry
orderSchema.pre("save", function (next) {
  if (this.isNew && (!this.timeline || this.timeline.length === 0)) {
    this.timeline = [
      {
        status: "placed",
        title: "Order Placed",
        description: "Your order has been received and is waiting for confirmation.",
        timestamp: new Date(),
        updatedBy: "System"
      }
    ];
  }
  next();
});

export default mongoose.model("Order", orderSchema);