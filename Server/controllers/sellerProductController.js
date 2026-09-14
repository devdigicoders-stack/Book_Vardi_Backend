import Product from "../models/Product.js";

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

// Get Distinct Product Categories & Catalog Items for the Logged-in Seller
export const getSellerProductCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category", { sellerId: req.user.id });
    const items = await Product.find({ sellerId: req.user.id }, "name price category status stock images").sort({ name: 1 });
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
    const filter = { sellerId: req.user.id };

    if (category) filter.category = category;
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (ageGroup) filter.ageGroup = { $regex: ageGroup, $options: "i" };
    if (size) filter.sizes = { $in: [size] };
    if (hasOffer === "true") filter["offer.hasOffer"] = true;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { schoolName: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { ageGroup: { $regex: search, $options: "i" } }
      ];
    }

    const products = await Product.find(filter).sort({
      createdAt: -1
    });
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
      unit,
      description,
      tags,
      status,
      offerDiscountType,
      offerDiscountValue,
      offerStartDate,
      offerEndDate,
      hasOffer
    } = req.body;

    const parsedPrice = price !== undefined ? Number(price) : (mrp !== undefined && discountPercentage !== undefined ? Number(mrp) - (Number(mrp) * Number(discountPercentage)) / 100 : undefined);

    if (!name || !category || parsedPrice === undefined || stock === undefined) {
      return res.status(400).json({
        message: "Product name, category, price (or MRP & discount %), and stock are required."
      });
    }

    // Process uploaded images
    const imagePaths = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        imagePaths.push(`/uploads/products/${file.filename}`);
      });
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

    const newProduct = new Product({
      sellerId: req.user.id,
      name,
      category,
      subCategory: subCategory || "",
      schoolName: schoolName || "",
      schoolCode: schoolCode || "",
      classGrade: classGrade || "",
      gender: gender || "Unisex",
      ageGroup: ageGroup || "",
      ages: parseArray(ages),
      sizes: parseArray(sizes),
      colors: parseArray(colors),
      material: material || "",
      brand: brand || "",
      mrp: mrp !== undefined ? Number(mrp) : Number(parsedPrice),
      price: Number(parsedPrice),
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : 0,
      stock: Number(stock),
      unit: unit || "piece",
      description: description || "",
      tags: parseArray(tags),
      images: imagePaths,
      status: status || "available",
      offer: offerConfig
    });

    await newProduct.save();

    res.status(201).json({
      message: "Product added successfully!",
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
    const product = await Product.findOne({ _id: id, sellerId: req.user.id });
    if (!product) {
      return res.status(404).json({ message: "Product not found or unauthorized" });
    }

    const updates = { ...req.body };

    // Parse array fields if present in update payload
    if (updates.sizes !== undefined) updates.sizes = parseArray(updates.sizes);
    if (updates.ages !== undefined) updates.ages = parseArray(updates.ages);
    if (updates.colors !== undefined) updates.colors = parseArray(updates.colors);
    if (updates.tags !== undefined) updates.tags = parseArray(updates.tags);
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.mrp !== undefined) updates.mrp = Number(updates.mrp);
    if (updates.discountPercentage !== undefined) updates.discountPercentage = Number(updates.discountPercentage);
    if (updates.stock !== undefined) updates.stock = Number(updates.stock);

    // If new images were uploaded, append them
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => `/uploads/products/${file.filename}`);
      updates.images = [...(product.images || []), ...newImages];
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
