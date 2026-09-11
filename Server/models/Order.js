import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  productId: {
    type: mongoose.Schema.Types.Mixed
  },
  sellerId: {
    type: mongoose.Schema.Types.Mixed
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, default: "" },
  category: { type: String, default: "Stationery" },
  size: { type: String, default: "" },
  age: { type: String, default: "" },
  color: { type: String, default: "" },
  discountPercentage: { type: Number, default: 0 },
  offerDiscount: { type: Number, default: 0 },
  finalPrice: { type: Number, default: function () { return this.price; } },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  total: { type: Number, default: function () { return (this.price || 0) * (this.quantity || 1); } },
  deliveryType: {
    type: String,
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
    courierName: { type: String, default: "" },
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
    type: String,
    default: "System"
  }
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      default: () => "SC-" + Math.floor(1000 + Math.random() * 9000)
    },
    id: { type: String },
    userId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User"
    },
    customer: {
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" }
    },
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    total: { type: Number, default: 0 },
    date: { type: String, default: "" },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    paymentMethod: {
      type: String,
      default: "UPI"
    },
    paymentStatus: {
      type: String,
      default: "paid"
    },
    razorpayOrderId: {
      type: String,
      default: ""
    },
    razorpayPaymentId: {
      type: String,
      default: ""
    },
    overallStatus: {
      type: String,
      default: "Processing"
    },
    trackingNumber: { type: String, default: "" },
    estimatedDeliveryDate: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    },
    estimatedDelivery: { type: String, default: "3-5 Business Days" },
    cancellationReason: {
      type: String,
      default: ""
    },
    timeline: [timelineEventSchema],
    address: { type: String },
    product: { type: String },
    quantity: { type: Number },
    amount: { type: Number },
    status: { type: String, default: "Processing" },
    deliveryBoy: { type: String }
  },
  {
    timestamps: true,
    strict: false
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