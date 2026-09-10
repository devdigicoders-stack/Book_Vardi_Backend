import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  landmark: { type: String, default: "" },
  addressType: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true
    },
    password: { type: String, required: [true, "Password is required"], minlength: 6 },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      unique: true,
      trim: true,
      sparse: true
    },
    avatar: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["active", "inactive", "blocked"], default: "active" },
    institution: { type: String, default: "" },
    studentId: { type: String, default: "" },
    phoneVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: "" },
    otpExpiresAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: { type: Date, default: null },
    addresses: [addressSchema]
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password helper
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);