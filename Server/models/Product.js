import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
      required: false
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true
    },
    subCategory: {
      type: String,
      trim: true,
      default: ""
    },
    schoolName: {
      type: String,
      trim: true,
      default: ""
    },
    schoolCode: {
      type: String,
      trim: true,
      default: "" // e.g. "DPS", "KV"
    },
    classGrade: {
      type: String,
      trim: true,
      default: "" // e.g. "Class 1-5", "Class 6-10"
    },
    gender: {
      type: String,
      enum: ["Boy", "Girl", "Unisex", "All"],
      default: "Unisex"
    },
    ageGroup: {
      type: String, // e.g. "3-5 Years", "6-8 Years", "9-12 Years", "13-16 Years", "16+ Years"
      trim: true,
      default: ""
    },
    ages: {
      type: [String], // e.g. ["3-4 Yrs", "5-6 Yrs", "7-8 Yrs"]
      default: []
    },
    sizes: {
      type: [String], // e.g. ["24", "26", "28", "30", "32", "34", "S", "M", "L", "XL"]
      default: []
    },
    colors: {
      type: [String], // e.g. ["White", "Navy Blue"]
      default: []
    },
    material: {
      type: String,
      trim: true,
      default: "" // e.g. "100% Premium Cotton"
    },
    brand: {
      type: String,
      trim: true,
      default: "" // e.g. "SchoolKart", "Sharma Uniforms"
    },
    price: {
      type: Number,
      required: [true, "Selling Price is required"],
      min: 0
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0
    },
    discountPercentage: {
      type: Number, // Discount % from MRP to Selling Price
      default: 0,
      min: 0,
      max: 100
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: 0,
      default: 0
    },
    unit: {
      type: String,
      default: "piece",
      trim: true // piece, pair, set, pack, book
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    images: {
      type: [String],
      default: []
    },
    tags: {
      type: [String], // e.g. ["Best Seller", "School Approved", "Pure Cotton"]
      default: []
    },
    // Per-Product Offer / Discount
    offer: {
      hasOffer: {
        type: Boolean,
        default: false
      },
      discountType: {
        type: String,
        enum: ["percentage", "flat"],
        default: "percentage"
      },
      discountValue: {
        type: Number,
        default: 0,
        min: 0
      },
      offerPrice: {
        type: Number,
        default: null
      },
      startDate: {
        type: Date,
        default: null
      },
      endDate: {
        type: Date,
        default: null
      },
      isActive: {
        type: Boolean,
        default: true
      }
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    numReviews: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["available", "out-of-stock", "discontinued"],
      default: "available"
    },
    // Admin Approval Lifecycle
    approvalStatus: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
      default: "Pending"
    },
    approvalComment: {
      type: String,
      default: ""
    },
    rejectionReason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// Indexes
productSchema.index({ sellerId: 1 });
productSchema.index({ category: 1, approvalStatus: 1 });

// Pre-save hook to calculate discountPercentage, offerPrice automatically & set MRP fallback
productSchema.pre("save", function (next) {
  // 1. Calculate price from MRP & discount percentage if price not explicitly different
  if (this.mrp && this.mrp > 0 && this.discountPercentage > 0 && (!this.price || this.price === this.mrp)) {
    this.price = Math.max(0, Math.round((this.mrp - (this.mrp * this.discountPercentage) / 100) * 100) / 100);
  } else if (this.mrp && this.mrp > 0 && this.price && this.mrp > this.price) {
    // If MRP and Price are provided, auto-calculate discount percentage
    this.discountPercentage = Math.round(((this.mrp - this.price) / this.mrp) * 100);
  } else if (!this.mrp || this.mrp < this.price) {
    // If MRP is less than price or missing, set MRP equal to selling price
    this.mrp = this.price;
    this.discountPercentage = 0;
  }

  // 2. Calculate promotional offer price
  if (this.offer && this.offer.hasOffer && this.offer.isActive && this.offer.discountValue > 0) {
    if (this.offer.discountType === "percentage") {
      const discount = (this.price * this.offer.discountValue) / 100;
      this.offer.offerPrice = Math.max(0, Math.round((this.price - discount) * 100) / 100);
    } else if (this.offer.discountType === "flat") {
      this.offer.offerPrice = Math.max(0, this.price - this.offer.discountValue);
    }
  } else if (this.offer) {
    this.offer.offerPrice = this.price;
  }
  next();
});

export default mongoose.model("Product", productSchema);