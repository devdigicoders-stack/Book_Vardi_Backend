import User from "../models/User.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const normalizePhone = (phoneValue) => String(phoneValue || "").replace(/\D/g, "");
const isValidPhone = (phoneValue) => /^\d{10}$/.test(normalizePhone(phoneValue));
const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user"
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// Phone OTP helpers
export const sendOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const purpose = String(req.body.purpose || "register").toLowerCase();

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    const existingUser = await User.findOne({ phone });

    if (purpose === "login" && !existingUser) {
      return res.status(404).json({ message: "This number is not registered. Please register yourself first." });
    }

    if (purpose === "register" && existingUser) {
      return res.status(409).json({ message: "This phone number is already registered. Please log in instead." });
    }

    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (existingUser) {
      existingUser.otpCode = otp;
      existingUser.otpExpiresAt = otpExpiresAt;
      existingUser.phoneVerified = false;
      await existingUser.save();
    } else {
      await User.create({
        name: "New User",
        email: `pending-${phone}@bookvardi.local`,
        password: `BookVardi@${phone.slice(-4)}`,
        phone,
        otpCode: otp,
        otpExpiresAt,
        phoneVerified: false
      });
    }

    res.json({
      message: "OTP sent successfully",
      phone,
      otp: process.env.NODE_ENV === "development" ? otp : undefined
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "No user found for this phone number" });
    }

    if (!user.otpCode || !user.otpExpiresAt || new Date(user.otpExpiresAt) < new Date()) {
      user.otpCode = "";
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.phoneVerified = true;
    user.otpCode = "";
    user.otpExpiresAt = null;
    await user.save();

    res.json({
      message: "OTP verified successfully",
      phoneVerified: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        phoneVerified: user.phoneVerified
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify OTP", error: error.message });
  }
};

// 1. Register User
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, institution, studentId } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = email ? email.toLowerCase().trim() : "";

    if (!name || !password) {
      return res.status(400).json({ message: "Name and password are required" });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    if (!normalizedEmail) {
      const generatedEmail = `student${normalizedPhone.slice(-4)}@bookvardi.local`;
      const existingEmailUser = await User.findOne({ email: generatedEmail });
      if (existingEmailUser && existingEmailUser.phone !== normalizedPhone) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
    }

    const userExists = await User.findOne({
      $or: [{ phone: normalizedPhone }, normalizedEmail ? { email: normalizedEmail } : { email: "" }]
    });

    if (userExists && userExists.phone !== normalizedPhone && userExists.email === normalizedEmail) {
      return res.status(400).json({ message: "An account with this phone or email already exists" });
    }

    const user = userExists || (await User.create({
      name,
      email: normalizedEmail || `student${normalizedPhone.slice(-4)}@bookvardi.local`,
      password,
      phone: normalizedPhone,
      institution: institution || "",
      studentId: studentId || "",
      phoneVerified: true
    }));

    user.name = name;
    user.email = normalizedEmail || user.email || `student${normalizedPhone.slice(-4)}@bookvardi.local`;
    user.password = password;
    user.phone = normalizedPhone;
    user.institution = institution || user.institution || "";
    user.studentId = studentId || user.studentId || "";
    user.phoneVerified = true;
    user.otpCode = "";
    user.otpExpiresAt = null;
    await user.save();

    const token = generateToken(user);

    console.log("[AUTH] User registered successfully:", {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      institution: user.institution,
      studentId: user.studentId,
      phoneVerified: user.phoneVerified,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        institution: user.institution,
        studentId: user.studentId,
        phoneVerified: user.phoneVerified,
        addresses: user.addresses
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

// 2. Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password, phone } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = email ? email.toLowerCase().trim() : "";

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = normalizedEmail
      ? await User.findOne({ email: normalizedEmail })
      : normalizedPhone
        ? await User.findOne({ phone: normalizedPhone })
        : null;

    if (!user) {
      return res.status(401).json({ message: "Invalid phone or email and password combination" });
    }

    if (user.status === "blocked") {
      return res.status(403).json({ message: "Your account is suspended. Please contact support." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid phone or email and password combination" });
    }

    const token = generateToken(user);

    console.log("[AUTH] User login successful:", {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        institution: user.institution,
        studentId: user.studentId,
        phoneVerified: user.phoneVerified,
        addresses: user.addresses
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

export const loginWithPhoneOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "A valid 10-digit phone number is required" });
    }

    if (!otp) {
      return res.status(400).json({ message: "OTP is required to login" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "No account found for this phone number" });
    }

    if (!user.otpCode || !user.otpExpiresAt || new Date(user.otpExpiresAt) < new Date()) {
      user.otpCode = "";
      user.otpExpiresAt = null;
      await user.save();
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.phoneVerified = true;
    user.otpCode = "";
    user.otpExpiresAt = null;
    await user.save();

    const token = generateToken(user);

    console.log("[AUTH] User login with OTP successful:", {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        institution: user.institution,
        studentId: user.studentId,
        phoneVerified: user.phoneVerified,
        addresses: user.addresses
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Phone OTP login failed", error: error.message });
  }
};

// 3. Get User Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
};

// 4. Update User Profile
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, phone, avatar, password } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (password) user.password = password;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        addresses: user.addresses
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

// 5. Add Delivery Address
export const addAddress = async (req, res) => {
  try {
    const { street, city, state, pincode, landmark, addressType, isDefault } = req.body;

    if (!street || !city || !state || !pincode) {
      return res.status(400).json({ message: "Street, city, state, and pincode are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    user.addresses.push({
      street,
      city,
      state,
      pincode,
      landmark: landmark || "",
      addressType: addressType || "Home",
      isDefault: isDefault || user.addresses.length === 0
    });

    await user.save();
    res.status(201).json({ message: "Address added successfully", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: "Failed to add address", error: error.message });
  }
};

// 6. Delete Delivery Address
export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.addresses = user.addresses.filter((addr) => addr._id.toString() !== req.params.addressId);
    await user.save();

    res.json({ message: "Address deleted successfully", addresses: user.addresses });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete address", error: error.message });
  }
};

// 7. Forgot Password (Generate Reset Token / OTP)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Return 200 for security to prevent email enumeration
      return res.json({
        message: "If an account exists with this email, a password reset token has been generated."
      });
    }

    // Generate 6-digit secure token or crypto string
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
    await user.save();

    res.json({
      message: "Password reset OTP/token generated successfully (Valid for 15 mins).",
      resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process forgot password", error: error.message });
  }
};

// 8. Reset Password with Token
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: "Email, reset token, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired password reset token." });
    }

    user.password = newPassword;
    user.resetPasswordToken = "";
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password reset successful! You can now log in with your new password." });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset password", error: error.message });
  }
};

