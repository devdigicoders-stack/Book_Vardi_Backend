import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  id: {
    type: mongoose.Schema.Types.Mixed
  },
  productId: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  name: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    default: ""
  },
  image: {
    type: String,
    default: ""
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    default: 0
  },
  originalPrice: {
    type: Number,
    default: 0
  }
});

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    userPhone: {
      type: String,
      default: ""
    },
    items: [cartItemSchema],
    totalAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

cartSchema.pre("save", function (next) {
  this.totalAmount = (this.items || []).reduce((total, item) => total + (item.price || 0) * (item.quantity || 1), 0);
  next();
});

export default mongoose.model("Cart", cartSchema);
