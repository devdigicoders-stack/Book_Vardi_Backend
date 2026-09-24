import mongoose from "mongoose";
import Product from "../models/Product.js";
import { saveBase64ToFile } from "./sellerAuthController.js";

// Helper function to safely parse array inputs from JSON or multipart form-data
const parseArray = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
      } catch (e) {
        // Fallback to comma separation
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

// Helper function to resolve expanded seller IDs across Seller and User collections
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

  const validObjectIds = rawIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const phoneList = rawIds.map((id) => String(id).replace(/\D/g, "")).filter((p) => p.length >= 8);
  const phoneVariants = phoneList.flatMap((p) => {
    const digits10 = p.slice(-10);
    return [p, digits10, `+91${digits10}`, `+91 ${digits10}`];
  });

  const Seller = (await import("../models/Seller.js")).default;
  const User = (await import("../models/User.js")).default;

  const orConditions = [
    ...(validObjectIds.length > 0 ? [{ _id: { $in: validObjectIds } }] : []),
    ...(phoneVariants.length > 0 ? [{ phone: { $in: phoneVariants } }] : [])
  ];

  if (orConditions.length > 0) {
    const sellerDocs = await Seller.find({ $or: orConditions }).select("_id phone email");
    sellerDocs.forEach((doc) => {
      sellerSet.add(doc._id);
      sellerSet.add(String(doc._id));
      if (doc.phone) {
        sellerSet.add(doc.phone);
        const cleanP = String(doc.phone).replace(/\D/g, "");
        if (cleanP) {
          sellerSet.add(cleanP);
          sellerSet.add(cleanP.slice(-10));
          sellerSet.add(`+91${cleanP.slice(-10)}`);
          sellerSet.add(`+91 ${cleanP.slice(-10)}`);
        }
      }
      if (doc.email) sellerSet.add(doc.email);
    });

    const userDocs = await User.find({ $or: orConditions }).select("_id phone email");
    userDocs.forEach((doc) => {
      sellerSet.add(doc._id);
      sellerSet.add(String(doc._id));
      if (doc.phone) {
        sellerSet.add(doc.phone);
        const cleanP = String(doc.phone).replace(/\D/g, "");
        if (cleanP) {
          sellerSet.add(cleanP);
          sellerSet.add(cleanP.slice(-10));
          sellerSet.add(`+91${cleanP.slice(-10)}`);
          sellerSet.add(`+91 ${cleanP.slice(-10)}`);
        }
      }
      if (doc.email) sellerSet.add(doc.email);
    });
  }

  return Array.from(sellerSet);
};

// Get Distinct Product Categories & Catalog Items for the Logged-in Seller
export const getSellerProductCategories = async (req, res) => {
  try {
    const expandedSellerIds = await getExpandedSellerIds(req);
    const validObjectIds = expandedSellerIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validObjectIds.length === 0) {
      return res.json({ categories: [], items: [] });
    }

    const filter = {
      $or: [
        { sellerId: { $in: validObjectIds } },
        { userId: { $in: validObjectIds } },
        { seller: { $in: validObjectIds } },
        { user: { $in: validObjectIds } },
        { createdBy: { $in: validObjectIds } }
      ]
    };

    const categories = await Product.distinct("category", filter);
    const items = await Product.find(filter, "name price category status stock images").sort({ name: 1 });

    res.json({
      categories: categories.filter(Boolean),
      items: items.map(p => ({
        id: p._id,
        name: p.name,
        price: p.price,
        category: p.category,
        status: p.status,
        stock: p.stock
      }))
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller categories", error: error.message });
  }
};

// Get All Products for the Logged-in Seller (with optional filters)
export const getSellerProducts = async (req, res) => {
  try {
    const { category, schoolName, search, hasOffer, ageGroup, size } = req.query;
    const expandedSellerIds = await getExpandedSellerIds(req);
    const validObjectIds = expandedSellerIds
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validObjectIds.length === 0) {
      return res.json([]);
    }

    let filter = {
      $or: [
        { sellerId: { $in: validObjectIds } },
        { userId: { $in: validObjectIds } },
        { seller: { $in: validObjectIds } },
        { user: { $in: validObjectIds } },
        { createdBy: { $in: validObjectIds } }
      ]
    };

    if (category) filter.category = category;
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (ageGroup) filter.ageGroup = { $regex: ageGroup, $options: "i" };
    if (size) filter.sizes = { $in: [size] };
    if (hasOffer === "true") filter["offer.hasOffer"] = true;

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const searchOr = [
        { name: searchRegex },
        { description: searchRegex },
        { schoolName: searchRegex },
        { category: searchRegex },
        { ageGroup: searchRegex }
      ];
      filter = { $and: [{ $or: filter.$or }, { $or: searchOr }] };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// Create a New Product by Seller
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subCategory,
      schoolName,
      schoolCode,
      classGrade,
      gender,
      ageGroup,
      ages,
      sizes,
      colors,
      material,
      brand,
      mrp,
      price,
      discountPercentage,
      stock,
      stockQuantity,
      unit,
      isMeterBased,
      minMeter,
      meterStep,
      isReturnable,
      returnWindowDays,
      sizeChart,
      description,
      tags,
      status,
      gst,
      gstPercentage,
      paymentMethodAllowed,
      paymentMethodsAllowed,
      offerDiscountType,
      offerDiscountValue,
      offerStartDate,
      offerEndDate,
      hasOffer
    } = req.body;

    const parsedPrice = price !== undefined ? Number(price) : (mrp !== undefined && discountPercentage !== undefined ? Number(mrp) - (Number(mrp) * Number(discountPercentage)) / 100 : undefined);
    const parsedStock = stock !== undefined ? Number(stock) : (stockQuantity !== undefined ? Number(stockQuantity) : 50);
    const parsedGst = gst !== undefined ? Number(gst) : (gstPercentage !== undefined ? Number(gstPercentage) : 5);

    if (!name || !category || parsedPrice === undefined || parsedStock === undefined) {
      return res.status(400).json({
        message: "Product name, category, price (or MRP & discount %), and stock are required."
      });
    }

    // Process uploaded images & JSON payload images
    const imagePaths = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        imagePaths.push(`/uploads/products/${file.filename}`);
      });
    }

    if (req.body && req.body.images) {
      let rawImages = req.body.images;
      if (typeof rawImages === "string") {
        try {
          rawImages = JSON.parse(rawImages);
        } catch (e) {
          rawImages = [rawImages];
        }
      }
      if (Array.isArray(rawImages)) {
        rawImages.forEach((img) => {
          if (img && typeof img === "string") {
            const savedPath = saveBase64ToFile(img, "products", "product");
            if (savedPath && !imagePaths.includes(savedPath)) {
              imagePaths.push(savedPath);
            }
          }
        });
      }
    }

    if (req.body && req.body.image && typeof req.body.image === "string") {
      const savedPath = saveBase64ToFile(req.body.image, "products", "product");
      if (savedPath && !imagePaths.includes(savedPath)) {
        imagePaths.unshift(savedPath);
      }
    }

    if (imagePaths.length === 0) {
      imagePaths.push("https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80");
    }

    // Configure per-product offer if requested
    const isOfferActive = hasOffer === "true" || hasOffer === true;
    const offerConfig = {
      hasOffer: isOfferActive,
      discountType: offerDiscountType || "percentage",
      discountValue: Number(offerDiscountValue) || 0,
      startDate: offerStartDate ? new Date(offerStartDate) : null,
      endDate: offerEndDate ? new Date(offerEndDate) : null,
      isActive: isOfferActive
    };

    const payMethod = paymentMethodAllowed || "Both";
    const payMethodsArr = payMethod === "COD_Only"
      ? ["COD"]
      : payMethod === "Online_Only"
      ? ["Online"]
      : (paymentMethodsAllowed ? parseArray(paymentMethodsAllowed) : ["COD", "Online"]);

    // Parse sizeVariants safely with all metadata fields (size, measureScale, measureValue, unit, price, mrp, stock, image, images, sku)
    let parsedSizeVariants = [];
    if (req.body.sizeVariants) {
      if (typeof req.body.sizeVariants === "string") {
        try {
          parsedSizeVariants = JSON.parse(req.body.sizeVariants);
        } catch (e) {
          parsedSizeVariants = [];
        }
      } else if (Array.isArray(req.body.sizeVariants)) {
        parsedSizeVariants = req.body.sizeVariants;
      }
    }

    // Parse sizeChart
    let parsedSizeChart = {};
    if (sizeChart) {
      if (typeof sizeChart === "string") {
        try { parsedSizeChart = JSON.parse(sizeChart); } catch (e) {}
      } else if (typeof sizeChart === "object") {
        parsedSizeChart = sizeChart;
      }
    }

    const formattedVariants = Array.isArray(parsedSizeVariants)
      ? parsedSizeVariants.map(v => {
          const sz = String(v.size || v.measureValue || "").trim();
          const mv = String(v.measureValue || v.size || "").trim();
          return {
            size: sz || mv,
            measureScale: String(v.measureScale || "size").trim(),
            measureValue: mv || sz,
            unit: String(v.unit || "Size").trim(),
            price: Number(v.price) || 0,
            mrp: Number(v.mrp) || Number(v.price) || 0,
            originalPrice: Number(v.originalPrice || v.mrp) || Number(v.price) || 0,
            stock: Number(v.stock) || 0,
            stockQuantity: Number(v.stockQuantity || v.stock) || 0,
            image: v.image || "",
            images: Array.isArray(v.images) && v.images.length > 0 ? v.images : (v.image ? [v.image] : []),
            sku: v.sku || ""
          };
        }).filter(v => v.size || v.measureValue)
      : [];

    let resolvedSizes = parseArray(sizes);
    if (formattedVariants.length > 0) {
      resolvedSizes = Array.from(new Set([...resolvedSizes, ...formattedVariants.map(v => v.size)]));
    }

    const effectivePrice = parsedPrice !== undefined 
      ? parsedPrice 
      : (formattedVariants.length > 0 ? Math.min(...formattedVariants.map(v => v.price)) : 0);
      
    const effectiveStock = parsedStock !== undefined 
      ? parsedStock 
      : (formattedVariants.length > 0 ? formattedVariants.reduce((sum, v) => sum + v.stock, 0) : 50);

    const sellerId = req.user?.id || req.seller?._id || req.user?._id;

    const isMeter = unit === "meter" || isMeterBased === true || isMeterBased === "true";
    const primaryImg = req.body.image || (imagePaths.length > 0 ? imagePaths[0] : "");

    const newProduct = new Product({
      sellerId,
      userId: sellerId,
      name,
      subtitle: subtitle || req.body.subtitle || "",
      category,
      subCategory: subCategory || "",
      schoolName: schoolName || "",
      schoolCode: schoolCode || "",
      classGrade: classGrade || "",
      gender: gender || "Unisex",
      ageGroup: ageGroup || "",
      ages: parseArray(ages),
      sizes: resolvedSizes,
      sizeVariants: formattedVariants,
      colors: parseArray(colors),
      material: material || "",
      brand: brand || "",
      gst: parsedGst,
      gstPercentage: parsedGst,
      mrp: mrp !== undefined ? Number(mrp) : Number(effectivePrice),
      originalPrice: req.body.originalPrice !== undefined ? Number(req.body.originalPrice) : (mrp !== undefined ? Number(mrp) : Number(effectivePrice)),
      price: Number(effectivePrice),
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : 0,
      discountBadge: req.body.discountBadge || req.body.badge || "",
      badgeTag: req.body.badgeTag || req.body.badge || "",
      badge: req.body.badge || req.body.discountBadge || "",
      bundleType: req.body.bundleType || "single",
      sku: req.body.sku || "",
      kitItems: req.body.kitItems || req.body.items || [],
      items: req.body.items || req.body.kitItems || [],
      totalMrp: req.body.totalMrp ? Number(req.body.totalMrp) : 0,
      bundlePrice: req.body.bundlePrice ? Number(req.body.bundlePrice) : 0,
      sellerStoreName: req.seller?.storeName || req.seller?.name || req.body.sellerStoreName || req.body.storeName || "",
      sellerName: req.seller?.name || req.body.sellerName || "",
      storeName: req.seller?.storeName || req.body.storeName || "",
      legalBusinessName: req.seller?.legalBusinessName || req.body.legalBusinessName || "",
      sellerAcceptsCod: req.seller?.acceptsCod !== false,
      sellerAcceptsOnline: req.seller?.acceptsOnline !== false,
      stock: Number(effectiveStock),
      stockQuantity: Number(effectiveStock),
      unit: isMeter ? "meter" : (unit || "piece"),
      isMeterBased: isMeter,
      minMeter: minMeter ? Number(minMeter) : 0.5,
      meterStep: meterStep ? Number(meterStep) : 0.5,
      isReturnable: isReturnable === undefined ? true : (isReturnable === true || isReturnable === "true"),
      returnWindowDays: returnWindowDays ? Number(returnWindowDays) : 7,
      sizeChart: parsedSizeChart,
      description: description || "",
      tags: parseArray(tags),
      image: primaryImg,
      images: imagePaths.length > 0 ? imagePaths : (primaryImg ? [primaryImg] : []),
      status: status || "available",
      approvalStatus: "Pending",
      approvalComment: "Product submitted by seller. Awaiting admin review.",
      paymentMethodAllowed: payMethod,
      paymentMethodsAllowed: payMethodsArr,
      offer: offerConfig
    });

    await newProduct.save();

    console.log("🆕 New Product Added to DB! Product ID:", newProduct._id);

    res.status(201).json({
      success: true,
      message: "Product added successfully! Submitted for admin approval.",
      product: newProduct
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Failed to create product", error: error.message });
  }
};

// Update Product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure product belongs to seller
    const expandedSellerIds = await getExpandedSellerIds(req);
    const validObjectIds = expandedSellerIds.filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));
    let product = await Product.findOne({
      _id: id,
      $or: [
        { sellerId: { $in: validObjectIds } },
        { userId: { $in: validObjectIds } }
      ]
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    const updates = { ...req.body };

    if (updates.gst !== undefined) {
      updates.gst = Number(updates.gst);
      updates.gstPercentage = Number(updates.gst);
    } else if (updates.gstPercentage !== undefined) {
      updates.gst = Number(updates.gstPercentage);
      updates.gstPercentage = Number(updates.gstPercentage);
    }

    // Parse sizeVariants
    if (updates.sizeVariants !== undefined) {
      let parsedVariants = [];
      if (typeof updates.sizeVariants === "string") {
        try {
          parsedVariants = JSON.parse(updates.sizeVariants);
        } catch (e) {
          parsedVariants = [];
        }
      } else if (Array.isArray(updates.sizeVariants)) {
        parsedVariants = updates.sizeVariants;
      }
      const formattedVariants = Array.isArray(parsedVariants)
        ? parsedVariants.map(v => {
            const sz = String(v.size || v.measureValue || "").trim();
            const mv = String(v.measureValue || v.size || "").trim();
            return {
              size: sz || mv,
              measureScale: String(v.measureScale || "size").trim(),
              measureValue: mv || sz,
              unit: String(v.unit || "Size").trim(),
              price: Number(v.price) || 0,
              mrp: Number(v.mrp) || Number(v.price) || 0,
              originalPrice: Number(v.originalPrice || v.mrp) || Number(v.price) || 0,
              stock: Number(v.stock) || 0,
              stockQuantity: Number(v.stockQuantity || v.stock) || 0,
              image: v.image || "",
              images: Array.isArray(v.images) && v.images.length > 0 ? v.images : (v.image ? [v.image] : []),
              sku: v.sku || ""
            };
          }).filter(v => v.size || v.measureValue)
        : [];

      updates.sizeVariants = formattedVariants;
      if (formattedVariants.length > 0) {
        updates.sizes = Array.from(new Set([...(updates.sizes ? parseArray(updates.sizes) : (product.sizes || [])), ...formattedVariants.map(v => v.size)]));
      }
    }

    // Parse array fields if present in update payload
    if (updates.sizes !== undefined && !updates.sizeVariants) updates.sizes = parseArray(updates.sizes);
    if (updates.ages !== undefined) updates.ages = parseArray(updates.ages);
    if (updates.colors !== undefined) updates.colors = parseArray(updates.colors);
    if (updates.tags !== undefined) updates.tags = parseArray(updates.tags);
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.mrp !== undefined) updates.mrp = Number(updates.mrp);
    if (updates.discountPercentage !== undefined) updates.discountPercentage = Number(updates.discountPercentage);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);
    if (updates.paymentMethodAllowed !== undefined) {
      const pMethod = updates.paymentMethodAllowed;
      updates.paymentMethodsAllowed = pMethod === "COD_Only"
        ? ["COD"]
        : pMethod === "Online_Only"
        ? ["Online"]
        : ["COD", "Online"];
    }

    // Process new images in req.files or req.body.images or req.body.image
    const updatedImagePaths = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        updatedImagePaths.push(`/uploads/products/${file.filename}`);
      });
    }

    if (updates.images) {
      let rawImages = updates.images;
      if (typeof rawImages === "string") {
        try {
          rawImages = JSON.parse(rawImages);
        } catch (e) {
          rawImages = [rawImages];
        }
      }
      if (Array.isArray(rawImages)) {
        rawImages.forEach((img) => {
          if (img && typeof img === "string") {
            const savedPath = saveBase64ToFile(img, "products", "product");
            if (savedPath && !updatedImagePaths.includes(savedPath)) {
              updatedImagePaths.push(savedPath);
            }
          }
        });
      }
      updates.images = Array.from(new Set(updatedImagePaths)).filter(Boolean);
    } else if (updatedImagePaths.length > 0) {
      updates.images = Array.from(new Set([...(product.images || []), ...updatedImagePaths])).filter(Boolean);
    }

    // If product was previously rejected, editing it resubmits into Pending approval queue
    if (product.approvalStatus === "Rejected") {
      product.approvalStatus = "Pending";
      product.approvalComment = "Resubmitted with modifications for admin review";
      product.rejectionReason = "";
    }

    // Apply updates
    Object.assign(product, updates);
    await product.save();

    res.json({
      message: "Product updated successfully!",
      product
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update product", error: error.message });
  }
};

// Quick Update Product Stock Quantity & Status (Inventory Tab)
export const updateInventoryStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stockQuantity, inStock, stock } = req.body;

    const product = await Product.findOne({ _id: id, sellerId: req.user.id });
    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    const nextStock = stockQuantity !== undefined ? Number(stockQuantity) : (stock !== undefined ? Number(stock) : product.stock);
    product.stock = Math.max(0, nextStock);

    if (inStock !== undefined) {
      product.status = inStock ? "available" : "out-of-stock";
    } else {
      product.status = product.stock > 0 ? "available" : "out-of-stock";
    }

    await product.save();

    res.json({
      message: "Inventory stock updated successfully!",
      stock: product.stock,
      status: product.status,
      product
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update inventory stock", error: error.message });
  }
};

// Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndDelete({
      _id: id,
      sellerId: req.user.id
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    res.json({ message: "Product deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete product", error: error.message });
  }
};

// Set / Update Special Offer on a Specific Product
export const setProductOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountType, discountValue, startDate, endDate, isActive } = req.body;

    const product = await Product.findOne({ _id: id, sellerId: req.user.id });
    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    if (discountValue === undefined || discountValue <= 0) {
      return res.status(400).json({ message: "Valid discount value is required" });
    }

    product.offer = {
      hasOffer: true,
      discountType: discountType || "percentage",
      discountValue: Number(discountValue),
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true
    };

    await product.save();

    res.json({
      message: "Offer applied to product successfully!",
      product
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to set offer", error: error.message });
  }
};

// Remove Offer from Product
export const removeProductOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({ _id: id, sellerId: req.user.id });
    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    product.offer = {
      hasOffer: false,
      discountType: "percentage",
      discountValue: 0,
      offerPrice: product.price,
      startDate: null,
      endDate: null,
      isActive: false
    };

    await product.save();

    res.json({
      message: "Offer removed from product",
      product
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove offer", error: error.message });
  }
};
