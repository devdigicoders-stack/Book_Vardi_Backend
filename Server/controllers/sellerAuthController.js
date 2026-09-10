import Seller from "../models/Seller.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Seller Registration (with KYC Document Uploads, Location & Delivery Preferences)
export const registerSeller = async (req, res) => {
  try {
    const {
      name,
      storeName,
      email,
      phone,
      password,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      formattedAddress,
      selfDelivery,
      maxDeliveryRadiusKm,
      thirdPartyDelivery,
      gstNumber,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      aadhaarNumber,
      panNumber
    } = req.body;

    // Validate required fields
    if (!name || !storeName || !email || !phone || !password || !address || !city || !state || !pincode) {
      return res.status(400).json({
        message: "Please fill all required personal, store, and address fields."
      });
    }

    // Validate self delivery radius if self delivery is chosen
    const isSelfDelivery = selfDelivery === undefined || selfDelivery === true || selfDelivery === "true";
    const parsedRadius = maxDeliveryRadiusKm ? parseFloat(maxDeliveryRadiusKm) : 10;
    if (isSelfDelivery && (isNaN(parsedRadius) || parsedRadius <= 0)) {
      return res.status(400).json({
        message: "Please specify a valid self-delivery radius in KM (e.g. 5, 10, 15 km)."
      });
    }

    // Check if seller email or phone already exists
    const existingSeller = await Seller.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });

    if (existingSeller) {
      return res.status(400).json({
        message: "A seller with this email or phone number already exists."
      });
    }

    // Extract uploaded documents paths
    const files = req.files || {};
    const aadhaarDoc = files.aadhaarDoc?.[0] ? `/uploads/documents/${files.aadhaarDoc[0].filename}` : "";
    const panDoc = files.panDoc?.[0] ? `/uploads/documents/${files.panDoc[0].filename}` : "";
    const passbookDoc = files.passbookDoc?.[0] ? `/uploads/documents/${files.passbookDoc[0].filename}` : "";
    const shopDoc = files.shopDoc?.[0] ? `/uploads/documents/${files.shopDoc[0].filename}` : "";

    // Parse coordinates if provided
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const geoCoordinates = (lng !== null && lat !== null) ? [lng, lat] : [0, 0];

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newSeller = new Seller({
      name,
      storeName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      address,
      city,
      state,
      pincode,
      location: {
        latitude: lat,
        longitude: lng,
        formattedAddress: formattedAddress || address,
        geo: {
          type: "Point",
          coordinates: geoCoordinates
        }
      },
      gstNumber: gstNumber || "",
      deliveryPreferences: {
        selfDelivery: isSelfDelivery,
        maxDeliveryRadiusKm: parsedRadius,
        thirdPartyDelivery: thirdPartyDelivery === undefined ? true : (thirdPartyDelivery === true || thirdPartyDelivery === "true")
      },
      bankDetails: {
        accountHolderName: accountHolderName || "",
        accountNumber: accountNumber || "",
        ifscCode: ifscCode || "",
        bankName: bankName || "",
        branchName: branchName || ""
      },
      documents: {
        aadhaarNumber: aadhaarNumber || "",
        aadhaarDoc,
        panNumber: panNumber || "",
        panDoc,
        passbookDoc,
        shopDoc
      },
      status: "pending" // Default state: waiting for Admin review
    });

    await newSeller.save();

    res.status(201).json({
      message: "Seller registered successfully! Your account is currently pending Admin review and approval.",
      sellerId: newSeller._id,
      storeName: newSeller.storeName,
      status: newSeller.status,
      location: newSeller.location,
      deliveryPreferences: newSeller.deliveryPreferences
    });
  } catch (error) {
    console.error("Seller registration error:", error);
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

// Seller Login (Strict verification check: only approved sellers allowed)
export const loginSeller = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const seller = await Seller.findOne({ email: email.toLowerCase() });
    if (!seller) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, seller.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Check Seller Approval Status
    if (seller.status === "pending") {
      return res.status(403).json({
        message: "Your seller account is pending admin approval. You will be able to log in once verified.",
        status: "pending"
      });
    }

    if (seller.status === "rejected") {
      return res.status(403).json({
        message: `Your seller application has been rejected. Reason: ${seller.rejectionReason || "Documents could not be verified."}`,
        status: "rejected",
        rejectionReason: seller.rejectionReason
      });
    }

    if (seller.status === "suspended") {
      return res.status(403).json({
        message: "Your seller account is suspended. Please contact support.",
        status: "suspended"
      });
    }

    // If Approved, generate JWT Token
    const token = jwt.sign(
      {
        id: seller._id,
        email: seller.email,
        storeName: seller.storeName,
        role: "seller"
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      seller: {
        id: seller._id,
        name: seller.name,
        storeName: seller.storeName,
        email: seller.email,
        phone: seller.phone,
        status: seller.status,
        role: "seller",
        location: seller.location
      }
    });
  } catch (error) {
    console.error("Seller login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// Get Logged-in Seller Profile
export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id).select("-password");
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }
    res.json(seller);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Seller Profile (Store, Address, Location, Bank details)
export const updateSellerProfile = async (req, res) => {
  try {
    const {
      name,
      storeName,
      phone,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude,
      formattedAddress,
      deliveryPreferences,
      gstNumber,
      bankDetails
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (storeName) updates.storeName = storeName;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    if (city) updates.city = city;
    if (state) updates.state = state;
    if (pincode) updates.pincode = pincode;
    if (gstNumber) updates.gstNumber = gstNumber;
    if (bankDetails) updates.bankDetails = bankDetails;
    if (deliveryPreferences) updates.deliveryPreferences = deliveryPreferences;

    // Update location if coordinates provided
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      updates.location = {
        latitude: lat,
        longitude: lng,
        formattedAddress: formattedAddress || address || "",
        geo: {
          type: "Point",
          coordinates: [lng, lat]
        }
      };
    }

    const updatedSeller = await Seller.findByIdAndUpdate(req.user.id, updates, {
      new: true
    }).select("-password");

    res.json({
      message: "Profile updated successfully",
      seller: updatedSeller
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

// Find Nearby Approved Sellers (Geo Proximity Search)
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng, radiusInKm = 15 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "Customer latitude (lat) and longitude (lng) query parameters are required."
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistanceInMeters = parseFloat(radiusInKm) * 1000; // convert km to meters

    // Find sellers near customer coordinates with 2dsphere near query
    const nearbySellers = await Seller.find({
      status: "approved",
      "location.geo": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistanceInMeters
        }
      }
    }).select("name storeName email phone address city state pincode location");

    res.json({
      count: nearbySellers.length,
      radiusInKm: parseFloat(radiusInKm),
      sellers: nearbySellers
    });
  } catch (error) {
    console.error("Nearby sellers error:", error);
    res.status(500).json({ message: "Failed to search nearby sellers", error: error.message });
  }
};
