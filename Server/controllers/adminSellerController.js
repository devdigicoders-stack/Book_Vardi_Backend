import Seller from "../models/Seller.js";
import User from "../models/User.js";

// Get All Sellers (with optional status filter)
export const getAllSellers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && ["pending", "approved", "rejected", "suspended"].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { storeName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const sellers = await Seller.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    const counts = {
      total: await Seller.countDocuments(),
      pending: await Seller.countDocuments({ status: "pending" }),
      approved: await Seller.countDocuments({ status: "approved" }),
      rejected: await Seller.countDocuments({ status: "rejected" }),
      suspended: await Seller.countDocuments({ status: "suspended" })
    };

    res.json({
      counts,
      sellers
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sellers", error: error.message });
  }
};

// Get Single Seller Details (KYC Documents, Bank Info, Store Details)
export const getSellerById = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id).select("-password");
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json(seller);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller details", error: error.message });
  }
};

// Approve Seller Application
export const approveSeller = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = "approved";
    seller.rejectionReason = "";
    seller.approvedAt = new Date();
    seller.approvedBy = req.user?.id || null;

    await seller.save();

    // Also update corresponding User document in DB if exists
    if (seller.email || seller.phone) {
      const cleanPhone = seller.phone ? String(seller.phone).replace(/\D/g, "").slice(-10) : "";
      const userConditions = [];
      if (seller.email) userConditions.push({ email: seller.email.toLowerCase().trim() });
      if (cleanPhone) userConditions.push({ phone: { $regex: cleanPhone + "$" } });

      if (userConditions.length > 0) {
        await User.updateMany(
          { $or: userConditions },
          { $set: { isSeller: true, sellerStatus: "approved", role: "Partner Merchant" } }
        );
      }
    }

    res.json({
      message: `Seller '${seller.storeName}' has been APPROVED successfully. They can now log in and manage products.`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        email: seller.email,
        status: seller.status,
        approvedAt: seller.approvedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to approve seller", error: error.message });
  }
};

// Set Seller Application Status Back to Pending
export const setPendingSeller = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = "pending";
    seller.rejectionReason = "";
    await seller.save();

    if (seller.email || seller.phone) {
      const cleanPhone = seller.phone ? String(seller.phone).replace(/\D/g, "").slice(-10) : "";
      const userConditions = [];
      if (seller.email) userConditions.push({ email: seller.email.toLowerCase().trim() });
      if (cleanPhone) userConditions.push({ phone: { $regex: cleanPhone + "$" } });

      if (userConditions.length > 0) {
        await User.updateMany(
          { $or: userConditions },
          { $set: { isSeller: false, sellerStatus: "pending" } }
        );
      }
    }

    res.json({
      message: `Seller '${seller.storeName}' status reset to PENDING approval.`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        status: seller.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to set seller status to pending", error: error.message });
  }
};

// Reject Seller Application (with reason)
export const rejectSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectionReason } = req.body;
    const msgReason = reason || rejectionReason;

    if (!msgReason || msgReason.trim().length === 0) {
      return res.status(400).json({
        message: "Rejection message/reason is required so the seller can know why verification failed."
      });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = "rejected";
    seller.rejectionReason = msgReason.trim();
    await seller.save();

    if (seller.email || seller.phone) {
      const cleanPhone = seller.phone ? String(seller.phone).replace(/\D/g, "").slice(-10) : "";
      const userConditions = [];
      if (seller.email) userConditions.push({ email: seller.email.toLowerCase().trim() });
      if (cleanPhone) userConditions.push({ phone: { $regex: cleanPhone + "$" } });

      if (userConditions.length > 0) {
        await User.updateMany(
          { $or: userConditions },
          { $set: { isSeller: false, sellerStatus: "rejected" } }
        );
      }
    }

    res.json({
      message: `Seller '${seller.storeName}' has been REJECTED with message: "${seller.rejectionReason}"`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        status: seller.status,
        rejectionReason: seller.rejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to reject seller", error: error.message });
  }
};

// Toggle or Set Any Seller Account Status (approved, pending, rejected, suspended)
export const toggleSellerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, rejectionReason } = req.body;
    const normalizedStatus = String(status || "").toLowerCase();

    if (!["approved", "pending", "rejected", "suspended"].includes(normalizedStatus)) {
      return res.status(400).json({
        message: "Status must be one of: 'approved', 'pending', 'rejected', or 'suspended'."
      });
    }

    const msgReason = reason || rejectionReason;
    if (normalizedStatus === "rejected" && (!msgReason || msgReason.trim().length === 0)) {
      return res.status(400).json({
        message: "Rejection message/reason is required when rejecting a seller."
      });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = normalizedStatus;
    if (normalizedStatus === "rejected") {
      seller.rejectionReason = msgReason.trim();
    } else if (normalizedStatus === "approved" || normalizedStatus === "pending") {
      seller.rejectionReason = "";
    }
    if (normalizedStatus === "approved") {
      seller.approvedAt = new Date();
      seller.approvedBy = req.user?.id || null;
    }

    await seller.save();

    if (seller.email || seller.phone) {
      const cleanPhone = seller.phone ? String(seller.phone).replace(/\D/g, "").slice(-10) : "";
      const userConditions = [];
      if (seller.email) userConditions.push({ email: seller.email.toLowerCase().trim() });
      if (cleanPhone) userConditions.push({ phone: { $regex: cleanPhone + "$" } });

      if (userConditions.length > 0) {
        const userUpdates = { sellerStatus: normalizedStatus };
        if (normalizedStatus === "approved") {
          userUpdates.isSeller = true;
          userUpdates.role = "Partner Merchant";
        } else {
          userUpdates.isSeller = false;
        }
        await User.updateMany({ $or: userConditions }, { $set: userUpdates });
      }
    }

    res.json({
      message: `Seller '${seller.storeName}' status updated to ${normalizedStatus.toUpperCase()}.`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        status: seller.status,
        rejectionReason: seller.rejectionReason
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update seller status", error: error.message });
  }
};

// Update Seller Commission Rate (%)
export const updateSellerCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate } = req.body;

    const rate = Number(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: "Invalid commission rate. Must be a percentage between 0 and 100." });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.commissionRate = rate;
    seller.commissionPercentage = rate;
    await seller.save();

    res.json({
      message: `Commission rate for '${seller.storeName}' updated to ${rate}%.`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        commissionRate: seller.commissionRate,
        commissionPercentage: seller.commissionPercentage
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update seller commission", error: error.message });
  }
};

