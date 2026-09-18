import mongoose from "mongoose";
import SellerOffer from "../models/SellerOffer.js";
import Coupon from "../models/Coupon.js";

// Helper to extract authenticated seller ID
const resolveSellerId = (req) => {
  return req.user?.id || req.seller?._id || req.headers["x-seller-id"] || req.query.sellerId || req.body.sellerId || null;
};

// 1. Get All Offers for the Logged-in Seller
export const getSellerOffers = async (req, res) => {
  try {
    const sellerId = resolveSellerId(req);
    const filter = sellerId ? { sellerId } : {};
    const offers = await SellerOffer.find(filter).sort({ createdAt: -1 });

    const normalized = offers.map((o) => ({
      id: o._id,
      _id: o._id,
      code: o.code,
      title: o.title,
      description: o.description,
      discountType: o.discountType,
      discountValue: o.discountValue,
      minOrderAmount: o.minOrderAmount,
      minOrderValue: o.minOrderAmount,
      maxDiscount: o.maxDiscount,
      startDate: o.startDate,
      validFrom: o.startDate ? new Date(o.startDate).toISOString().split("T")[0] : "",
      endDate: o.endDate,
      validUntil: o.endDate ? new Date(o.endDate).toISOString().split("T")[0] : "",
      status: o.status,
      createdAt: o.createdAt
    }));

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch offers", error: error.message });
  }
};

// 2. Create a New Store Offer / Coupon
export const createSellerOffer = async (req, res) => {
  try {
    const sellerId = resolveSellerId(req);

    const {
      title,
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      minOrderValue,
      maxDiscount,
      startDate,
      validFrom,
      endDate,
      validUntil,
      specificProductId,
      applicableProducts
    } = req.body;

    let targetApplicableProducts = [];
    if (Array.isArray(applicableProducts)) {
      targetApplicableProducts = applicableProducts.map(String);
    } else if (specificProductId) {
      targetApplicableProducts = [String(specificProductId)];
    }

    const couponCode = code || req.body.couponCode;

    if (!couponCode || discountValue === undefined || (discountValue !== undefined && Number(discountValue) <= 0)) {
      return res.status(400).json({
        message: "Coupon code and a positive discount value are required."
      });
    }

    const cleanCode = String(couponCode).trim().toUpperCase();
    const offerTitle = title || cleanCode;
    const finalStartDate = startDate || validFrom ? new Date(startDate || validFrom) : new Date();
    const rawEndDate = endDate || validUntil;
    const finalEndDate = rawEndDate ? new Date(rawEndDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const finalMinAmount = Number(minOrderAmount ?? minOrderValue ?? 0);
    const finalMaxDiscount = Number(maxDiscount ?? 0);

    let offer = null;
    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      offer = await SellerOffer.findOne({ sellerId, code: cleanCode });
    } else {
      offer = await SellerOffer.findOne({ code: cleanCode });
    }

    if (offer) {
      offer.title = offerTitle;
      offer.description = description || offer.description || "";
      offer.discountType = discountType || offer.discountType || "percentage";
      offer.discountValue = Number(discountValue);
      offer.minOrderAmount = finalMinAmount;
      offer.maxDiscount = finalMaxDiscount;
      offer.startDate = finalStartDate;
      offer.endDate = finalEndDate;
      offer.status = "active";
      offer.createdRole = "seller";
      if (targetApplicableProducts.length > 0) offer.applicableProducts = targetApplicableProducts;
      await offer.save();
    } else {
      const targetSellerId = (sellerId && mongoose.Types.ObjectId.isValid(sellerId))
        ? sellerId
        : new mongoose.Types.ObjectId();

      offer = new SellerOffer({
        sellerId: targetSellerId,
        title: offerTitle,
        code: cleanCode,
        description: description || "",
        discountType: discountType || "percentage",
        discountValue: Number(discountValue),
        minOrderAmount: finalMinAmount,
        maxDiscount: finalMaxDiscount,
        startDate: finalStartDate,
        endDate: finalEndDate,
        status: "active",
        createdRole: "seller",
        applicableProducts: targetApplicableProducts
      });
      await offer.save();
    }

    // Sync to Coupon collection for buyer cart validation
    try {
      await Coupon.findOneAndUpdate(
        { code: cleanCode },
        {
          code: cleanCode,
          discount: Number(discountValue),
          type: (discountType === "flat" || discountType === "fixed") ? "fixed" : "percentage",
          minAmount: finalMinAmount,
          expiryDate: finalEndDate,
          status: "active",
          storeId: offer.sellerId || null,
          sellerId: offer.sellerId || null,
          createdRole: "seller",
          applicableProducts: targetApplicableProducts
        },
        { upsert: true, new: true }
      );
    } catch (e) {
      console.warn("Coupon model sync notice:", e.message);
    }

    res.status(201).json({
      message: "Offer/Coupon created & saved to database successfully!",
      offer
    });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(500).json({ message: "Failed to create offer", error: error.message });
  }
};

// 3. Update Seller Offer
export const updateSellerOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = resolveSellerId(req);

    const filter = (sellerId && mongoose.Types.ObjectId.isValid(sellerId))
      ? { _id: id, sellerId }
      : { _id: id };

    const offer = await SellerOffer.findOne(filter);

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const {
      title,
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      minOrderValue,
      maxDiscount,
      startDate,
      validFrom,
      endDate,
      validUntil,
      status
    } = req.body;

    if (title) offer.title = title;
    if (code) offer.code = String(code).trim().toUpperCase();
    if (description !== undefined) offer.description = description;
    if (discountType) offer.discountType = discountType;
    if (discountValue !== undefined) offer.discountValue = Number(discountValue);
    if (minOrderAmount !== undefined || minOrderValue !== undefined) {
      offer.minOrderAmount = Number(minOrderAmount ?? minOrderValue);
    }
    if (maxDiscount !== undefined) offer.maxDiscount = Number(maxDiscount);
    if (startDate || validFrom) offer.startDate = new Date(startDate || validFrom);
    if (endDate || validUntil) offer.endDate = new Date(endDate || validUntil);
    if (status) offer.status = status;

    await offer.save();

    // Sync to Coupon collection
    try {
      await Coupon.findOneAndUpdate(
        { code: offer.code },
        {
          code: offer.code,
          discount: offer.discountValue,
          type: (offer.discountType === "flat" || offer.discountType === "fixed") ? "fixed" : "percentage",
          minAmount: offer.minOrderAmount,
          expiryDate: offer.endDate,
          status: offer.status === "active" ? "active" : "inactive"
        },
        { upsert: true }
      );
    } catch (e) {}

    res.json({
      message: "Offer updated successfully!",
      offer
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update offer", error: error.message });
  }
};

// 4. Delete Seller Offer
export const deleteSellerOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await SellerOffer.findByIdAndDelete(id);

    if (offer && offer.code) {
      try {
        await Coupon.findOneAndDelete({ code: offer.code });
      } catch (e) {}
    }

    res.json({ message: "Offer deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete offer", error: error.message });
  }
};

// 5. Toggle Offer Active / Expired Status
export const toggleSellerOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await SellerOffer.findById(id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    offer.status = offer.status === "active" ? "expired" : "active";
    await offer.save();

    try {
      await Coupon.findOneAndUpdate(
        { code: offer.code },
        { status: offer.status === "active" ? "active" : "expired" }
      );
    } catch (e) {}

    res.json({
      message: `Offer status toggled to ${offer.status}`,
      status: offer.status,
      offer
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle offer status", error: error.message });
  }
};
