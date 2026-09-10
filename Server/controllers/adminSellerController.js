import Seller from "../models/Seller.js";

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

// Reject Seller Application (with reason)
export const rejectSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        message: "Rejection reason is required so the seller can know why verification failed."
      });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = "rejected";
    seller.rejectionReason = reason.trim();
    await seller.save();

    res.json({
      message: `Seller '${seller.storeName}' has been REJECTED.`,
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

// Toggle Suspend / Active Seller Account
export const toggleSellerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "suspended"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either 'approved' or 'suspended'."
      });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.status = status;
    await seller.save();

    res.json({
      message: `Seller account status changed to ${status}.`,
      seller: {
        id: seller._id,
        storeName: seller.storeName,
        status: seller.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update seller status", error: error.message });
  }
};
