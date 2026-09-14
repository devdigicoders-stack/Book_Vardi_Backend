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
    const addressProofDoc = files.addressProofDoc?.[0] ? `/uploads/documents/${files.addressProofDoc[0].filename}` : "";
    const profilePhoto = files.profilePhoto?.[0] ? `/uploads/documents/${files.profilePhoto[0].filename}` : (files.avatar?.[0] ? `/uploads/documents/${files.avatar[0].filename}` : "");

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
        shopDoc,
        addressProofDoc,
        profilePhoto
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

// Get Seller Store Operations Settings
export const getSellerSettings = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id).select(
      "storeName email phone address city state pincode gstNumber deliveryPreferences bankDetails storeDetails"
    );
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    res.json({
      storeName: seller.storeName,
      legalName: seller.name,
      email: seller.email,
      phone: seller.phone,
      gstin: seller.gstNumber,
      address: seller.address,
      city: seller.city,
      pincode: seller.pincode,
      deliveryPreferences: seller.deliveryPreferences,
      bankDetails: seller.bankDetails,
      storeDetails: seller.storeDetails || {}
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller settings", error: error.message });
  }
};

// Update Seller Store Operations Settings
export const updateSellerSettings = async (req, res) => {
  try {
    const { storeName, email, phone, gstin, address, city, pincode, deliveryPreferences, storeDetails } = req.body;
    const updates = {};

    if (storeName) updates.storeName = storeName;
    if (phone) updates.phone = phone;
    if (gstin) updates.gstNumber = gstin;
    if (address) updates.address = address;
    if (city) updates.city = city;
    if (pincode) updates.pincode = pincode;
    if (deliveryPreferences) updates.deliveryPreferences = deliveryPreferences;
    if (storeDetails) updates.storeDetails = storeDetails;

    const updatedSeller = await Seller.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    res.json({
      success: true,
      message: "Store settings updated successfully",
      seller: updatedSeller
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update seller settings", error: error.message });
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

// Send Phone OTP for Seller Login & Onboarding
export const sendSellerPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }
    // Return testing OTP 123456
    res.json({
      success: true,
      message: `OTP code 123456 dispatched to +91 ${phone.replace(/\D/g, "")}`,
      otp: "123456"
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send OTP", error: error.message });
  }
};

// Verify Phone OTP & Authenticate Seller
export const verifySellerPhoneOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const cleanPhone = (phone || "").replace(/\D/g, "");

    if (!cleanPhone || cleanPhone.length < 8) {
      return res.status(400).json({ message: "Please enter a valid mobile number." });
    }

    if (!otp || otp.trim() !== "123456") {
      return res.status(400).json({ message: "Invalid OTP code. Please use testing code 123456." });
    }

    let seller = await Seller.findOne({ phone: { $regex: cleanPhone } });

    if (!seller) {
      // Auto-create pending seller shell for new phone registration
      seller = new Seller({
        name: "Merchant " + cleanPhone.slice(-4),
        storeName: "Book Vardi Partner Store",
        email: `seller_${cleanPhone}@bookvardi.in`,
        phone: `+91 ${cleanPhone}`,
        password: await bcrypt.hash("123456", 10),
        address: "Registered Merchant Address",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        status: "pending"
      });
      await seller.save();
    }

    const token = jwt.sign(
      { id: seller._id, email: seller.email, storeName: seller.storeName, role: "seller" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Phone OTP verified successfully",
      token,
      sellerStatus: seller.status,
      seller: {
        id: seller._id,
        name: seller.name,
        storeName: seller.storeName,
        email: seller.email,
        phone: seller.phone,
        status: seller.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed", error: error.message });
  }
};

// Get Application Status for Logged-in Seller
export const getSellerApplicationStatus = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id).select("status storeName name phone rejectionReason");
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    res.json({
      sellerStatus: seller.status,
      storeName: seller.storeName,
      name: seller.name,
      phone: seller.phone,
      rejectionReason: seller.rejectionReason
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch status", error: error.message });
  }
};

// Instant Admin Approval Testing Shortcut
export const adminApproveSellerTest = async (req, res) => {
  try {
    const sellerId = req.user ? req.user.id : req.body.sellerId;
    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { status: "approved", approvedAt: new Date() },
      { new: true }
    );
    if (!seller) return res.status(404).json({ message: "Seller not found" });

    res.json({
      success: true,
      message: "Seller status updated to approved!",
      sellerStatus: seller.status
    });
  } catch (error) {
    res.status(500).json({ message: "Approval failed", error: error.message });
  }
};

// Update Pending/Unapproved Seller 12-Step Application Details
export const updateSellerApplication = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const {
      sellerName,
      legalBusinessName,
      tradeName,
      sellerPhone,
      sellerEmail,
      ownerFullName,
      ownerDesignation,
      ownerPan,
      businessPan,
      gstin,
      addressLine1,
      city,
      state,
      pincode,
      bankAccountHolder,
      bankAccountNumber,
      bankIfscCode,
      bankName
    } = req.body;

    const files = req.files || {};
    const updates = {
      name: sellerName || ownerFullName,
      storeName: tradeName || legalBusinessName,
      email: sellerEmail ? sellerEmail.toLowerCase() : undefined,
      phone: sellerPhone,
      address: addressLine1,
      city,
      state,
      pincode,
      gstNumber: gstin,
      status: "pending" // Resubmit resets status to pending for review
    };

    // Clean undefined fields
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

    if (bankAccountHolder || bankAccountNumber || bankIfscCode) {
      updates.bankDetails = {
        accountHolderName: bankAccountHolder || "",
        accountNumber: bankAccountNumber || "",
        ifscCode: bankIfscCode || "",
        bankName: bankName || ""
      };
    }

    if (files.profilePhoto?.[0] || files.addressProofDoc?.[0]) {
      updates.documents = {
        profilePhoto: files.profilePhoto?.[0] ? `/uploads/documents/${files.profilePhoto[0].filename}` : undefined,
        addressProofDoc: files.addressProofDoc?.[0] ? `/uploads/documents/${files.addressProofDoc[0].filename}` : undefined,
        panNumber: ownerPan || businessPan
      };
    }

    const updatedSeller = await Seller.findByIdAndUpdate(sellerId, updates, { new: true });
    res.json({
      success: true,
      message: "Seller application updated successfully! Pending review.",
      sellerStatus: updatedSeller.status,
      seller: updatedSeller
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update application", error: error.message });
  }
};

// Upload Base64 File directly to Physical Server Disk (uploads/avatars or uploads/documents)
export const uploadBase64Document = async (req, res) => {
  try {
    const { dataUrl, folder = "documents", fieldName = "doc" } = req.body;
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      return res.status(400).json({ message: "Invalid base64 data URL provided" });
    }

    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ message: "Invalid base64 format" });
    }

    const mime = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    let ext = ".png";
    if (mime.includes("pdf")) ext = ".pdf";
    else if (mime.includes("jpeg") || mime.includes("jpg")) ext = ".jpg";
    else if (mime.includes("webp")) ext = ".webp";

    const targetSubfolder = folder === "avatars" ? "avatars" : "documents";
    const uploadDir = path.join(process.cwd(), "uploads", targetSubfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${fieldName}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${targetSubfolder}/${filename}`;
    console.log(`Saved file to disk: ${filePath} => ${relativeUrl}`);

    res.json({
      success: true,
      url: relativeUrl,
      fileName: filename
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to save file to disk", error: error.message });
  }
};


