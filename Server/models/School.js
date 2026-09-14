import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    schoolId: { type: String, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    code: { type: String },
    board: { type: String, default: "CBSE" },
    city: { type: String, required: true },
    address: { type: String },
    pincode: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    classes: { type: String, default: "Nursery to 12th" },
    studentCount: { type: Number, default: 1000 },
    contactPerson: { type: String },
    email: { type: String },
    phone: { type: String },
    status: { type: String, default: "Partner Active" },
    exclusiveKit: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);
