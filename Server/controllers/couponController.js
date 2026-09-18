import Coupon from "../models/Coupon.js";
import SellerOffer from "../models/SellerOffer.js";

// 1. Validate & Apply Coupon
export const applyCoupon = async (req, res) => {
  try {
    const { code, cartTotal, cartItems } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    if (cartTotal === undefined || Number(cartTotal) <= 0) {
      return res.status(400).json({ message: "Valid cart total is required" });
    }

    const cleanCode = String(code).toUpperCase().trim();
    let coupon = await Coupon.findOne({
      code: cleanCode,
      status: "active"
    });

    if (!coupon) {
      const offer = await SellerOffer.findOne({
        code: cleanCode,
        status: "active"
      });

      if (offer) {
        coupon = {
          code: offer.code,
          discount: offer.discountValue,
          type: (offer.discountType === "flat" || offer.discountType === "fixed") ? "fixed" : "percentage",
          minAmount: offer.minOrderAmount || 0,
          expiryDate: offer.endDate,
          sellerId: offer.sellerId,
          createdRole: "seller",
          applicableProducts: offer.applicableProducts || []
        };
      }
    }

    if (!coupon) {
      return res.status(404).json({ message: "Invalid or inactive coupon code" });
    }

    // Check expiry
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      if (typeof coupon.save === "function") {
        coupon.status = "expired";
        await coupon.save();
      }
      return res.status(400).json({ message: "This coupon code has expired" });
    }

    // Determine coupon seller & product scoping
    const isSellerScoped = Boolean(coupon.createdRole === "seller" || coupon.sellerId || coupon.storeId);
    const targetSellerId = coupon.sellerId ? String(coupon.sellerId) : (coupon.storeId ? String(coupon.storeId) : null);
    const applicableProds = (coupon.applicableProducts || []).map(p => String(p));

    let eligibleSubtotal = Number(cartTotal);

    if (Array.isArray(cartItems) && cartItems.length > 0) {
      const eligibleItems = cartItems.filter((item) => {
        const itemSellerId = item.sellerId ? String(item.sellerId) : (item.seller ? String(item.seller) : (item.storeId ? String(item.storeId) : null));
        const itemProductId = item.id ? String(item.id) : (item._id ? String(item._id) : (item.productId ? String(item.productId) : null));

        if (isSellerScoped) {
          // Seller-created coupon applies ONLY to items from that seller
          if (targetSellerId && itemSellerId && itemSellerId !== targetSellerId) {
            return false;
          }
          // If seller chose specific products, check product match
          if (applicableProds.length > 0) {
            return applicableProds.includes(itemProductId);
          }
          return true;
        } else {
          // Admin-created coupon applies to every product (unless admin set specific applicableProducts)
          if (applicableProds.length > 0) {
            return applicableProds.includes(itemProductId);
          }
          return true;
        }
      });

      if (eligibleItems.length === 0) {
        if (isSellerScoped) {
          return res.status(400).json({
            message: applicableProds.length > 0
              ? "This coupon is only applicable to specific products from this seller."
              : "This seller-created coupon is only applicable to products from this seller."
          });
        } else {
          return res.status(400).json({
            message: "This coupon is not applicable to any items in your cart."
          });
        }
      }

      eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    }

    // Check minimum purchase requirement on eligible subtotal
    if (eligibleSubtotal < coupon.minAmount) {
      return res.status(400).json({
        message: `Minimum purchase of ₹${coupon.minAmount} on eligible items is required to use this coupon.`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === "percentage") {
      discountAmount = Math.round(((eligibleSubtotal * coupon.discount) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(eligibleSubtotal, coupon.discount);
    }

    const finalPayable = Math.max(0, Math.round((Number(cartTotal) - discountAmount) * 100) / 100);

    res.json({
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
        minAmount: coupon.minAmount,
        createdRole: coupon.createdRole || (targetSellerId ? "seller" : "admin"),
        sellerId: targetSellerId,
        applicableProducts: applicableProds
      },
      cartTotal: Number(cartTotal),
      eligibleSubtotal,
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
    }).select("code discount type minAmount expiryDate createdRole sellerId storeId applicableProducts");

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch coupons", error: error.message });
  }
};

// 3. Admin: Create Coupon
export const createCoupon = async (req, res) => {
  try {
    const { code, discount, type, minAmount, expiryDate, storeId, sellerId, createdRole, applicableProducts } = req.body;

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
      storeId: storeId || sellerId || null,
      sellerId: sellerId || storeId || null,
      createdRole: createdRole || (sellerId || storeId ? "seller" : "admin"),
      applicableProducts: Array.isArray(applicableProducts) ? applicableProducts.map(String) : []
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
