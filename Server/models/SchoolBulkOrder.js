import mongoose from "mongoose";

const requirementItemSchema = new mongoose.Schema({
  category: { type: String, required: true },
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, default: 100 },
  sampleImage: { type: String, default: "" },
  notes: { type: String, default: "" }
});

const schoolBulkOrderSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true },
    institutionName: { type: String, required: true },
    schoolId: { type: String, default: "" },
    institutionType: { type: String, default: "K-12 School" },

    contactName: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    designation: { type: String, default: "Administrator" },

    address: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },

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
