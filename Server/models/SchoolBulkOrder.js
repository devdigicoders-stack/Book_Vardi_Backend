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

    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "Seller", index: true },
    status: { type: String, default: "pending" } // pending, under_review, quoted, fulfilled, rejected
  },
  { timestamps: true }
);

export default mongoose.model("SchoolBulkOrder", schoolBulkOrderSchema);
