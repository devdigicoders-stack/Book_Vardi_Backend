import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Seller name is required"],
      trim: true
    },
    storeName: {
      type: String,
      required: [true, "Store/Shop name is required"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6
    },
    // Store Address
    address: {
      type: String,
      required: [true, "Store address is required"]
    },
    city: {
      type: String,
      required: [true, "City is required"]
    },
    state: {
      type: String,
      required: [true, "State is required"]
    },
    pincode: {
      type: String,
      required: [true, "Pincode is required"]
    },
    gstNumber: {
      type: String,
      trim: true,
      default: ""
    },

    // Geo-Location (Google Maps Lat/Long & Proximity Search)
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      formattedAddress: { type: String, default: "" },
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point"
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0]
        }
      }
    },

    // Bank Account Details for Payouts
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifscCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      branchName: { type: String, default: "" }
    },

    // KYC & Business Documents
    documents: {
      aadhaarNumber: { type: String, default: "" },
      aadhaarDoc: { type: String, default: "" }, // local file path / URL
      panNumber: { type: String, default: "" },
      panDoc: { type: String, default: "" }, // local file path / URL
      passbookDoc: { type: String, default: "" }, // passbook / cancelled cheque
      shopDoc: { type: String, default: "" }, // Trade License / Shop Act / Registration
      addressProofDoc: { type: String, default: "" }, // Electricity bill / rent agreement
      profilePhoto: { type: String, default: "" } // Seller avatar / profile picture
    },

    // Delivery Capabilities & Preferences
    deliveryPreferences: {
      selfDelivery: {
        type: Boolean,
        default: true
      },
      maxDeliveryRadiusKm: {
        type: Number,
        default: 10,
        min: 1
      },
      thirdPartyDelivery: {
        type: Boolean,
        default: true
      }
    },

    // Financials, Wallet & Commission
    commissionPercentage: {
      type: Number,
      default: 5, // Default platform fee: 5%
      min: 0,
      max: 100
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0
    },

    // Approval & Account Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending"
    },
    rejectionReason: {
      type: String,
      default: ""
    },
    approvedAt: {
      type: Date
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    },
    role: {
      type: String,
      default: "seller"
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere index for nearby store location queries
sellerSchema.index({ "location.geo": "2dsphere" });

export default mongoose.model("Seller", sellerSchema);
