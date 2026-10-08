import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  productId: {
    type: mongoose.Schema.Types.Mixed
  },
  sellerId: {
    type: mongoose.Schema.Types.Mixed
  },
  sellerName: { type: String, default: "" },
  storeName: { type: String, default: "" },
  sellerPhone: { type: String, default: "" },
  sellerEmail: { type: String, default: "" },
  sellerAddress: { type: String, default: "" },
  sellerCity: { type: String, default: "" },
  sellerDetails: {
    sellerId: { type: mongoose.Schema.Types.Mixed },
    storeName: { type: String, default: "" },
    sellerName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" }
  },
  gst: { type: Number, default: 5 },
  gstPercent: { type: Number, default: 5 },
  gstPercentage: { type: Number, default: 5 },
  gstRate: { type: Number, default: 5 },
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
  quantity: { type: Number, required: true, min: 0.01, default: 1 },
  total: { type: Number, default: function () { return Math.round(((this.price || 0) * (this.quantity || 1)) * 100) / 100; } },
  isReturnable: { type: Boolean, default: true },
  isRefundable: { type: Boolean, default: true },
  isExchangeable: { type: Boolean, default: true },
  returnWindowDays: { type: Number, default: 7 },
  returnPolicy: { type: String, default: "" },
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
    deliveryOtp: { type: String, default: () => Math.floor(1000 + Math.random() * 9000).toString() },
    deliveryPartnerToken: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    driverLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null }
    },
    otpLastSentAt: { type: Date, default: null },
    whatsappStatus: { type: String, default: "" },
    whatsappSentAt: { type: Date, default: null },
    whatsappMessageId: { type: String, default: "" },
    whatsappSentTo: { type: String, default: "" }
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

export const generateProductOrderId = () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let prefix = "";
  for (let i = 0; i < 3; i++) {
    prefix += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${num}`;
};

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      default: generateProductOrderId
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
      default: "Pending"
    },
    deliveryMode: {
      type: String,
      enum: ["third_party", "self_delivery", "pending_choice", "standard", "express", ""],
      default: "pending_choice"
    },
    courierName: { type: String, default: "" },
    carrier: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    sellerDetails: {
      sellerId: { type: mongoose.Schema.Types.Mixed },
      storeName: { type: String, default: "" },
      sellerName: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" }
    },
    selfDeliveryDetails: {
      deliveryPersonName: { type: String, default: "" },
      deliveryPersonPhone: { type: String, default: "" },
      vehicleNumber: { type: String, default: "" },
      deliveryOtp: { type: String, default: () => Math.floor(1000 + Math.random() * 9000).toString() },
      deliveryPartnerToken: { type: String, default: "" },
      trackingUrl: { type: String, default: "" },
      driverLocation: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        updatedAt: { type: Date, default: null }
      },
      otpLastSentAt: { type: Date, default: null },
      whatsappStatus: { type: String, default: "" },
      whatsappSentAt: { type: Date, default: null },
      whatsappMessageId: { type: String, default: "" },
      whatsappSentTo: { type: String, default: "" }
    },
    deliveryOtp: {
      type: String,
      default: () => Math.floor(1000 + Math.random() * 9000).toString()
    },
    estimatedDeliveryDate: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    },
    estimatedDelivery: { type: String, default: "3-5 Business Days" },
    cancellationReason: {
      type: String,
      default: ""
    },
    cancelledBy: {
      type: String,
      default: ""
    },
    refundStatus: {
      type: String,
      default: ""
    },
    refundDetails: {
      method: { type: String, enum: ["UPI", "BANK", ""], default: "" },
      upiId: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      accountHolderName: { type: String, default: "" },
      submittedAt: { type: Date, default: null }
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    codCollectedAt: {
      type: Date,
      default: null
    },
    codCollectedBy: {
      type: String,
      default: ""
    },
    returnRequest: {
      type: {
        type: String,
        enum: ["return", "exchange", null],
        default: null
      },
      reason: { type: String, default: "" },
      comment: { type: String, default: "" },
      exchangeSize: { type: String, default: "" },
      exchangeLength: { type: Number, default: null },
      isMeterBased: { type: Boolean, default: false },
      exchangeColor: { type: String, default: "" },
      priceDifference: { type: Number, default: 0 },
      priceAdjustmentType: { type: String, enum: ["extra_payment", "partial_refund", "none", ""], default: "none" },
      originalItemPrice: { type: Number, default: 0 },
      replacementItemPrice: { type: Number, default: 0 },
      refundMethod: { type: String, default: "Original Payment Method" },
      refundDetails: {
        method: { type: String, enum: ["UPI", "BANK", ""], default: "" },
        upiId: { type: String, default: "" },
        bankName: { type: String, default: "" },
        accountNumber: { type: String, default: "" },
        ifscCode: { type: String, default: "" },
        accountHolderName: { type: String, default: "" }
      },
      requestedAt: { type: Date, default: null },
      updatedAt: { type: Date, default: null },
      pickupDate: { type: Date, default: null },
      rejectionReason: { type: String, default: "" },
      refundTxnId: { type: String, default: "" },
      exchangeAwb: { type: String, default: "" },
      exchangeCourier: { type: String, default: "" },
      status: {
        type: String,
        enum: ["no_request","requested", "approved", "rejected", "pickup_scheduled", "product_received", "refund_initiated", "refund_processed", "refund_completed", "exchange_dispatched", "exchanged"],
        default: "no_request"
      },
      returnEligibleUntil: { type: Date, default: null }
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
  if (!this.orderId || /^[0-9a-fA-F]{24}$/.test(this.orderId)) {
    this.orderId = generateProductOrderId();
  }
  if (!this.id || /^[0-9a-fA-F]{24}$/.test(this.id)) {
    this.id = this.orderId;
  }
  if (!this.date) {
    this.date = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  }
  next();
});

orderSchema.index({ sellerId: 1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ "items.sellerId": 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);