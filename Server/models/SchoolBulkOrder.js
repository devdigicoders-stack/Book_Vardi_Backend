import mongoose from "mongoose";

const requirementItemSchema = new mongoose.Schema(
  {
    category: { type: String, default: "General Bulk Procurement" },
    itemName: { type: String, default: "Bulk Stationery / Uniform" },
    quantity: { type: Number, default: 100 },
    sampleImage: { type: String, default: "" },
    notes: { type: String, default: "" }
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", required: true },
    sellerName: { type: String, required: true },
    sellerStoreName: { type: String, default: "" },
    sellerPhone: { type: String, default: "" },
    sellerCity: { type: String, default: "" },

    quoteAmount: { type: Number, required: true },
    unitPrice: { type: Number, default: 0 },
    estimatedDeliveryDays: { type: Number, default: 7 },
    proposedDeliveryDate: { type: String, default: "" },
    notes: { type: String, default: "" },

    status: {
      type: String,
      enum: ["submitted", "under_review", "approved", "rejected"],
      default: "submitted"
    },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const schoolBulkOrderSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true },
    institutionName: { type: String, required: true },
    schoolId: { type: String, default: "" },
    institutionType: { type: String, default: "K-12 School" },

    contactName: { type: String, required: true },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, required: true },
    designation: { type: String, default: "Administrator" },

    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },

    requirements: [requirementItemSchema],

    totalQuantity: { type: Number, default: 0 },
    targetDeliveryDate: { type: String, default: "" },
    logoEmbroideryRequired: { type: Boolean, default: false },
    targetBudgetPerKit: { type: String, default: "" },
    additionalNotes: { type: String, default: "" },

    // Distribution & Assignment Options: unassigned, direct, selected, broadcast
    assignmentMode: {
      type: String,
      enum: ["unassigned", "direct", "selected", "broadcast"],
      default: "unassigned"
    },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", index: true }, // Assigned seller
    invitedSellerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Seller" }],

    // Seller Quotations & Counter Offers
    quotations: [quotationSchema],
    acceptedQuoteId: { type: mongoose.Schema.Types.ObjectId },

    // Status: pending, under_review, published, assigned, quoted, quote_accepted, in_production, fulfilled, rejected
    status: { type: String, default: "pending" }
  },
  { timestamps: true }
);

export default mongoose.model("SchoolBulkOrder", schoolBulkOrderSchema);
