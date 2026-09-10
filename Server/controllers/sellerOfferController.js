import SellerOffer from "../models/SellerOffer.js";

// Get All Offers for the Logged-in Seller
export const getSellerOffers = async (req, res) => {
  try {
    const offers = await SellerOffer.find({ sellerId: req.user.id }).sort({
      createdAt: -1
    });
    res.json(offers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch offers", error: error.message });
  }
};

// Create a New Store Offer / Coupon
export const createSellerOffer = async (req, res) => {
  try {
    const {
      title,
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate
    } = req.body;

    if (!title || !code || discountValue === undefined || !endDate) {
      return res.status(400).json({
        message: "Title, Coupon Code, Discount Value, and End Date are required."
      });
    }

    const cleanCode = code.trim().toUpperCase();

    // Check if code already exists for this seller
    const existingOffer = await SellerOffer.findOne({
      sellerId: req.user.id,
      code: cleanCode
    });

    if (existingOffer) {
      return res.status(400).json({
        message: `Coupon code '${cleanCode}' already exists for your store.`
      });
    }

    const offer = new SellerOffer({
      sellerId: req.user.id,
      title,
      code: cleanCode,
      description: description || "",
      discountType: discountType || "percentage",
      discountValue: Number(discountValue),
      minOrderAmount: Number(minOrderAmount) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      status: "active"
    });

    await offer.save();

    res.status(201).json({
      message: "Offer/Coupon created successfully!",
      offer
    });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(500).json({ message: "Failed to create offer", error: error.message });
  }
};

// Update Seller Offer
export const updateSellerOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await SellerOffer.findOne({
      _id: id,
      sellerId: req.user.id
    });

    if (!offer) {
      return res.status(404).json({ message: "Offer not found or unauthorized" });
    }

    const {
      title,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      startDate,
      endDate,
      status
    } = req.body;

    if (title) offer.title = title;
    if (description !== undefined) offer.description = description;
    if (discountType) offer.discountType = discountType;
    if (discountValue !== undefined) offer.discountValue = Number(discountValue);
    if (minOrderAmount !== undefined) offer.minOrderAmount = Number(minOrderAmount);
    if (maxDiscount !== undefined) offer.maxDiscount = Number(maxDiscount);
    if (startDate) offer.startDate = new Date(startDate);
    if (endDate) offer.endDate = new Date(endDate);
    if (status) offer.status = status;

    await offer.save();

    res.json({
      message: "Offer updated successfully!",
      offer
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update offer", error: error.message });
  }
};

// Delete Seller Offer
export const deleteSellerOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await SellerOffer.findOneAndDelete({
      _id: id,
      sellerId: req.user.id
    });

    if (!offer) {
      return res.status(404).json({ message: "Offer not found or unauthorized" });
    }

    res.json({ message: "Offer deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete offer", error: error.message });
  }
};
