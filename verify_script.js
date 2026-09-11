import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MongoUri;

const addressSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.Mixed },
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  addressLine: { type: String, default: "" },
  street: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  pincode: { type: String, default: "" },
  landmark: { type: String, default: "" },
  type: { type: String, default: "Home" },
  addressType: { type: String, default: "Home" },
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    password: { type: String, default: "BookVardi@123" },
    phone: { type: String, default: "", trim: true },
    avatar: { type: String, default: "" },
    institution: { type: String, default: "", trim: true },
    studentId: { type: String, default: "", trim: true },
    standard: { type: String, default: "", trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active" },
    addresses: [addressSchema]
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function verifyUser() {
  try {
    await mongoose.connect(mongoUri);

    const targetPhone = "1231231232";
    const cleanPhone = String(targetPhone).replace(/\D/g, "");

    let user = await User.findOne({
      $or: [
        { phone: targetPhone },
        { phone: { $regex: cleanPhone + "$" } }
      ]
    }).select("-password");

    if (!user) {
      console.log(`⚠️ User with phone "${targetPhone}" not found.`);
      process.exit(1);
    }

    if (!user.addresses || user.addresses.length === 0) {
      console.log(`Adding sample address to user document in MongoDB for phone "${targetPhone}"...`);
      user.addresses.push({
        id: Date.now(),
        name: user.name || "Ritesh Yadav",
        phone: targetPhone,
        addressLine: "Flat 402, Royal Palms Residency, Sector 14",
        street: "MG Road, Sector 14",
        city: "Gurugram",
        state: "Haryana",
        pincode: "122001",
        landmark: "Opposite City Centre Mall",
        type: "Home",
        addressType: "Home",
        isDefault: true
      });
      await user.save();
      console.log("Saved address into MongoDB user schema successfully!\n");
    }

    console.log("===============================================================================");
    console.log("             BACKEND MONGODB DB USER DATA (PHONE: 1231231232)                   ");
    console.log("===============================================================================");
    console.log(JSON.stringify({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      institution: user.institution,
      studentId: user.studentId,
      standard: user.standard,
      role: user.role,
      avatar: user.avatar,
      addresses: user.addresses,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }, null, 2));
    console.log("===============================================================================");
  } catch (error) {
    console.error("Error querying backend database:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

verifyUser();
