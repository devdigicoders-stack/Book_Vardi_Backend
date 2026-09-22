import mongoose from "mongoose";

const kitItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: false
  },
  name: {
    type: String,
    required: [true, "Item name is required"], // e.g. "White Shirt", "Navy Blue Pant"
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, "Item quantity is required"], // e.g. 2
    min: 1,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  size: {
    type: String,
    default: ""
  },
  color: {
    type: String,
    default: ""
  }
});

const kitSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: false
    },
    title: {
      type: String,
      required: [true, "Kit bundle title is required"], // e.g. "Delhi Public School Complete Uniform Kit"
      trim: true
    },
    schoolName: {
      type: String,
      required: [true, "School name is required"], // e.g. "Delhi Public School"
      trim: true
    },
    schoolCode: {
      type: String,
      trim: true,
      default: "" // e.g. "DPS", "KV"
    },
    gender: {
      type: String,
      enum: ["Boy", "Girl", "Unisex"],
      required: [true, "Target gender is required"]
    },
    classGrade: {
      type: String,
      required: [true, "Target class/grade is required"], // e.g. "Class 1-5", "Class 6-10"
      trim: true
    },
    badgeTag: {
      type: String,
      enum: ["Best Seller", "New Arrival", "Verified KV", "School Approved", "Trending", "Special Offer", ""],
      default: "School Approved"
    },
    items: {
      type: [kitItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Kit bundle must contain at least one item."
      }
    },
    totalMrp: {
      type: Number,
      required: true,
      min: 0
    },
    bundlePrice: {
      type: Number,
      required: [true, "Bundle/Kit discounted price is required"],
      min: 0
    },
    savingsAmount: {
      type: Number,
      default: 0
    },
    discountPercentage: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      required: [true, "Kit stock is required"],
      min: 0,
      default: 10
    },
    images: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 0,
      max: 5
    },
    ratingCount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["available", "out-of-stock", "inactive"],
      default: "available"
    },
    approvalStatus: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
      default: "Pending"
    },
    paymentMethodAllowed: {
      type: String,
      enum: ["Both", "Online_Only", "COD_Only"],
      default: "Both"
    },
    paymentMethodsAllowed: {
      type: [String],
      default: ["COD", "Online"]
    }
  },
  {
    timestamps: true
  }
);

// Indexes
kitSchema.index({ sellerId: 1 });

// Calculate totalMrp, savingsAmount, and discountPercentage automatically before saving
kitSchema.pre("save", function (next) {
  if (this.items && this.items.length > 0) {
    const calculatedTotalMrp = this.items.reduce((sum, item) => {
      const itemTotal = item.totalPrice || item.unitPrice * (item.quantity || 1);
      item.totalPrice = itemTotal;
      return sum + itemTotal;
    }, 0);

    this.totalMrp = calculatedTotalMrp;

    if (this.bundlePrice && this.bundlePrice < this.totalMrp) {
      this.savingsAmount = Math.max(0, this.totalMrp - this.bundlePrice);
      this.discountPercentage = Math.round((this.savingsAmount / this.totalMrp) * 100);
    } else {
      this.bundlePrice = this.totalMrp;
      this.savingsAmount = 0;
      this.discountPercentage = 0;
    }
  }
  next();
});

export default mongoose.model("Kit", kitSchema);
