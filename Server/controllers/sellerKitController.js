import mongoose from "mongoose";
import Kit from "../models/Kit.js";

const getExpandedSellerIds = async (req) => {
  const rawIds = [
    req.user?.id,
    req.seller?._id,
    req.seller?.id,
    req.user?._id,
    req.user?.phone,
    req.seller?.phone,
    req.headers["x-seller-id"],
    req.headers["x-user-phone"],
    req.query?.sellerId
  ].filter(id => id && id !== "undefined" && id !== "null" && id !== "[object Object]");

  const sellerSet = new Set();
  rawIds.forEach((id) => {
    sellerSet.add(String(id));
    if (mongoose.Types.ObjectId.isValid(id)) {
      sellerSet.add(new mongoose.Types.ObjectId(id));
    }
  });
  return Array.from(sellerSet);
};

// Get all kits created by the logged-in Seller
export const getSellerKits = async (req, res) => {
  try {
    const sellerIds = await getExpandedSellerIds(req);
    const validObjectIds = sellerIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(id));

    const filter = {
      isDeleted: { $ne: true },
      status: { $nin: ["deleted"] },
      $or: [
        { sellerId: { $in: [...validObjectIds, ...sellerIds] } },
        { seller: { $in: [...validObjectIds, ...sellerIds] } },
        { createdBy: { $in: [...validObjectIds, ...sellerIds] } }
      ]
    };

    const kits = await Kit.find(filter)
      .populate("items.productId", "name price images category")
      .sort({ createdAt: -1 });
    res.json(kits);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch kits", error: error.message });
  }
};

// Get single seller kit by ID
export const getSellerKitById = async (req, res) => {
  try {
    const sellerIds = await getExpandedSellerIds(req);
    const validObjectIds = sellerIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(id));

    const kit = await Kit.findOne({
      _id: req.params.id,
      isDeleted: { $ne: true },
      status: { $nin: ["deleted"] },
      $or: [
        { sellerId: { $in: [...validObjectIds, ...sellerIds] } },
        { seller: { $in: [...validObjectIds, ...sellerIds] } },
        { createdBy: { $in: [...validObjectIds, ...sellerIds] } }
      ]
    }).populate("items.productId", "name price images category");

    if (!kit) {
      return res.status(404).json({ message: "Kit bundle not found or unauthorized" });
    }

    res.json(kit);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch kit", error: error.message });
  }
};

// Create a New Complete Uniform Kit Bundle
export const createKit = async (req, res) => {
  try {
    const {
      title,
      schoolName,
      schoolCode,
      gender,
      classGrade,
      badgeTag,
      items,
      bundlePrice,
      stock,
      description,
      status
    } = req.body;

    if (!title || !schoolName || !gender || !classGrade || !bundlePrice) {
      return res.status(400).json({
        message: "Title, School Name, Gender, Class/Grade, and Bundle Price are required."
      });
    }

    // Parse items if passed as stringified JSON from multipart/form-data
    let parsedItems = items;
    if (typeof items === "string") {
      try {
        parsedItems = JSON.parse(items);
      } catch (e) {
        return res.status(400).json({ message: "Invalid items format. Must be JSON array." });
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        message: "Kit bundle must contain at least one item (e.g. Shirt, Pant, Tie, Socks)."
      });
    }

    // Process uploaded kit images
    const imagePaths = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        imagePaths.push(`/uploads/products/${file.filename}`);
      });
    }

    // Calculate total MRP of included items
    const formattedItems = parsedItems.map((item) => {
      const quantity = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice) || Number(item.price) || 0;
      return {
        productId: item.productId || null,
        name: item.name,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        size: item.size || "",
        color: item.color || ""
      };
    });

    const totalMrp = formattedItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const finalBundlePrice = Number(bundlePrice);
    const savingsAmount = Math.max(0, totalMrp - finalBundlePrice);
    const discountPercentage = totalMrp > 0 ? Math.round((savingsAmount / totalMrp) * 100) : 0;

    const newKit = new Kit({
      sellerId: req.user.id,
      title,
      schoolName,
      schoolCode: schoolCode || "",
      gender,
      classGrade,
      badgeTag: badgeTag || "School Approved",
      items: formattedItems,
      totalMrp,
      bundlePrice: finalBundlePrice,
      savingsAmount,
      discountPercentage,
      stock: Number(stock) || 10,
      images: imagePaths,
      description: description || "",
      status: status || "available"
    });

    await newKit.save();

    res.status(201).json({
      message: "Complete Uniform Kit Bundle created successfully!",
      kit: newKit
    });
  } catch (error) {
    console.error("Create kit error:", error);
    res.status(500).json({ message: "Failed to create kit", error: error.message });
  }
};

// Update Kit Bundle
export const updateKit = async (req, res) => {
  try {
    const { id } = req.params;

    const kit = await Kit.findOne({ _id: id, sellerId: req.user.id });
    if (!kit) {
      return res.status(404).json({ message: "Kit bundle not found or unauthorized" });
    }

    const updates = { ...req.body };

    // Handle parsed items if provided
    if (updates.items) {
      let parsedItems = updates.items;
      if (typeof updates.items === "string") {
        try {
          parsedItems = JSON.parse(updates.items);
        } catch (e) {
          return res.status(400).json({ message: "Invalid items JSON format." });
        }
      }
      updates.items = parsedItems.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice) || Number(item.price) || 0;
        return {
          productId: item.productId || null,
          name: item.name,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          size: item.size || "",
          color: item.color || ""
        };
      });
    }

    // Append new uploaded images if any
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => `/uploads/products/${file.filename}`);
      updates.images = [...(kit.images || []), ...newImages];
    }

    Object.assign(kit, updates);
    await kit.save();

    res.json({
      message: "Kit bundle updated successfully!",
      kit
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update kit", error: error.message });
  }
};

// Delete Kit Bundle
export const deleteKit = async (req, res) => {
  try {
    const { id } = req.params;

    const kit = await Kit.findOneAndDelete({ _id: id, sellerId: req.user.id });
    if (!kit) {
      return res.status(404).json({ message: "Kit bundle not found or unauthorized" });
    }

    res.json({ message: "Kit bundle deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete kit", error: error.message });
  }
};
