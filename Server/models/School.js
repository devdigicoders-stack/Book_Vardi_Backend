import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    schoolId: { type: String, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    code: { type: String },
    board: { type: String, default: "CBSE" },
    city: { type: String, required: true },
    district: { type: String, default: "" },
    subdistrict: { type: String, default: "" },
    address: { type: String },
    pincode: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    classes: { 
      type: [String], 
      default: ["Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"] 
    },
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
