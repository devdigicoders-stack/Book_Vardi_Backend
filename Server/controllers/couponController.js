import Coupon from "../models/Coupon.js";

// 1. Validate & Apply Coupon
export const applyCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    if (cartTotal === undefined || Number(cartTotal) <= 0) {
      return res.status(400).json({ message: "Valid cart total is required" });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
      status: "active"
    });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid or inactive coupon code" });
    }

    // Check expiry
    if (new Date(coupon.expiryDate) < new Date()) {
      coupon.status = "expired";
      await coupon.save();
      return res.status(400).json({ message: "This coupon code has expired" });
    }

    // Check minimum purchase requirement
    if (Number(cartTotal) < coupon.minAmount) {
      return res.status(400).json({
        message: `Minimum order amount of ₹${coupon.minAmount} required to use this coupon.`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = Math.round(((Number(cartTotal) * coupon.discount) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(Number(cartTotal), coupon.discount);
    }

    const finalPayable = Math.max(0, Math.round((Number(cartTotal) - discountAmount) * 100) / 100);

    res.json({
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
        minAmount: coupon.minAmount
      },
      cartTotal: Number(cartTotal),
      discountAmount,
      finalPayable
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to apply coupon", error: error.message });
  }
};

// 2. Get All Active Coupons (Public list for banners/promos)
export const getActiveCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      status: "active",
      expiryDate: { $gte: new Date() }
    }).select("code discount type minAmount expiryDate");

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
  }
};

// 3. Admin: Create Coupon
export const createCoupon = async (req, res) => {
  try {
    const { code, discount, type, minAmount, expiryDate, storeId } = req.body;

    if (!code || discount === undefined || !type || minAmount === undefined || !expiryDate) {
      return res.status(400).json({ message: "All coupon fields are required" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discount: Number(discount),
      type,
      minAmount: Number(minAmount),
      expiryDate: new Date(expiryDate),
      storeId: storeId || null
    });

    res.status(201).json({ message: "Coupon created successfully", coupon });
  } catch (error) {
    res.status(500).json({ message: "Failed to create coupon", error: error.message });
  }
};

// 4. Admin: Get all coupons
export const getAllCouponsAdmin = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
  }
};

// 5. Admin: Delete Coupon
export const deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete coupon", error: error.message });
  }
};
