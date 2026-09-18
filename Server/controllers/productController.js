import mongoose from "mongoose";
import Product from "../models/Product.js";

// Helper function to safely parse array inputs
const parseArray = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
      } catch (e) {}
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

// Get all products (with optional filtering by category, search, school, size, age, discount, offer, ids, tag)
export const getProducts = async (req, res) => {
  try {
    const {
      ids,
      tag,
      category,
      subCategory,
      schoolName,
      gender,
      classGrade,
      ageGroup,
      age,
      size,
      sizes,
      search,
      hasOffer,
      minDiscount,
      minPrice,
      maxPrice,
      sellerId
    } = req.query;

    const filter = (req.query.all === "true" || req.query.includePending === "true")
      ? {}
      : { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };

    if (ids) {
      const parsedIds = parseArray(ids);
      const validObjectIds = parsedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validObjectIds.length > 0) {
        filter._id = { $in: validObjectIds };
      }
    }
    if (tag) {
      filter.tags = { $in: [tag] };
    }
    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (gender && gender !== "All") filter.gender = gender;
    if (classGrade) filter.classGrade = { $regex: classGrade, $options: "i" };
    if (sellerId) filter.sellerId = sellerId;

    // Filter by Age Group or specific Age
    const targetAge = ageGroup || age;
    if (targetAge) {
      filter.$or = [
        { ageGroup: { $regex: targetAge, $options: "i" } },
        { ages: { $in: [new RegExp(targetAge, "i")] } }
      ];
    }

    // Filter by Size(s)
    const targetSizes = size ? [size] : sizes ? parseArray(sizes) : null;
    if (targetSizes && targetSizes.length > 0) {
      filter.sizes = { $in: targetSizes };
    }

    // Filter by Price range
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Filter by Minimum Discount percentage
    if (minDiscount) {
      filter.$or = [
        { discountPercentage: { $gte: Number(minDiscount) } },
        { "offer.discountValue": { $gte: Number(minDiscount) } }
      ];
    }

    // Filter by Active Offer
    if (hasOffer === "true") {
      filter["offer.hasOffer"] = true;
      filter["offer.isActive"] = true;
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      const searchConditions = [
        { name: searchRegex },
        { description: searchRegex },
        { schoolName: searchRegex },
        { category: searchRegex },
        { brand: searchRegex },
        { ageGroup: searchRegex },
        { sizes: { $in: [new RegExp(search, "i")] } }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Sorting
    const { sortBy = "newest", page = 1, limit = 20 } = req.query;
    let sortOption = { createdAt: -1 };
    if (sortBy === "price_asc") sortOption = { price: 1 };
    else if (sortBy === "price_desc") sortOption = { price: -1 };
    else if (sortBy === "rating") sortOption = { averageRating: -1, numReviews: -1 };
    else if (sortBy === "discount") sortOption = { discountPercentage: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const totalProducts = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("sellerId", "storeName name city phone")
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    res.json({
      total: totalProducts,
      page: pageNum,
      totalPages: Math.ceil(totalProducts / limitNum),
      limit: limitNum,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// Get Recently Viewed products by ID array or fallback to newest
export const getRecentlyViewedProducts = async (req, res) => {
  try {
    const { ids, category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));
    const parsedIds = parseArray(ids);
    const validObjectIds = parsedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    let filter = { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category) filter.category = category;

    if (validObjectIds.length > 0) {
      filter._id = { $in: validObjectIds };
      const products = await Product.find(filter).populate("sellerId", "storeName name city phone");

      // Sort products in the exact order of requested IDs
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));
      const orderedProducts = validObjectIds
        .map((id) => productMap.get(id.toString()))
        .filter(Boolean);

      if (orderedProducts.length > 0) {
        return res.json({
          total: orderedProducts.length,
          count: orderedProducts.length,
          products: orderedProducts.slice(0, limitNum)
        });
      }
    }

    // Fallback if no valid IDs provided or matched: return newest products
    const fallbackFilter = { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category) fallbackFilter.category = category;
    const products = await Product.find(fallbackFilter)
      .populate("sellerId", "storeName name city phone")
      .sort({ createdAt: -1 })
      .limit(limitNum);

    res.json({
      total: products.length,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recently viewed products", error: error.message });
  }
};

// Get Featured / Trending products
export const getFeaturedProducts = async (req, res) => {
  try {
    const { category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    const filter = { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category) filter.category = category;

    const products = await Product.find(filter)
      .populate("sellerId", "storeName name city phone")
      .sort({ averageRating: -1, numReviews: -1, createdAt: -1 })
      .limit(limitNum);

    res.json({
      total: products.length,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch featured products", error: error.message });
  }
};

// Get Special Offers products
export const getSpecialOffers = async (req, res) => {
  try {
    const { category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    const filter = {
      status: "available",
      approvalStatus: { $nin: ["Pending", "Rejected"] },
      $or: [
        { "offer.hasOffer": true },
        { discountPercentage: { $gt: 0 } }
      ]
    };
    if (category) filter.category = category;

    let products = await Product.find(filter)
      .populate("sellerId", "storeName name city phone")
      .sort({ discountPercentage: -1, "offer.discountValue": -1, createdAt: -1 })
      .limit(limitNum);

    if (products.length < limitNum) {
      const fallbackFilter = { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };
      if (category) fallbackFilter.category = category;
      const extraProducts = await Product.find(fallbackFilter)
        .populate("sellerId", "storeName name city phone")
        .sort({ discountPercentage: -1, createdAt: -1 })
        .limit(limitNum);

      const existingIds = new Set(products.map((p) => p._id.toString()));
      for (const extra of extraProducts) {
        if (!existingIds.has(extra._id.toString()) && products.length < limitNum) {
          products.push(extra);
        }
      }
    }

    res.json({
      total: products.length,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch special offers", error: error.message });
  }
};

// Get Recommended products
export const getRecommendedProducts = async (req, res) => {
  try {
    const { category, schoolName, classGrade, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    const filter = { status: "available", approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category) filter.category = category;
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (classGrade) filter.classGrade = { $regex: classGrade, $options: "i" };

    const products = await Product.find(filter)
      .populate("sellerId", "storeName name city phone")
      .sort({ numReviews: -1, averageRating: -1, createdAt: -1 })
      .limit(limitNum);

    res.json({
      total: products.length,
      count: products.length,
      products
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recommended products", error: error.message });
  }
};

// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "sellerId",
      "storeName name city phone"
    );
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    const isPublicRequest = req.query.all !== "true" && req.query.includePending !== "true";
    if (isPublicRequest && (product.approvalStatus === "Pending" || product.approvalStatus === "Rejected")) {
      return res.status(404).json({ message: "Product not found or pending admin approval" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch product", error: error.message });
  }
};

// Create new product (Admin / General)
export const createProduct = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (typeof payload.sizeVariants === "string") {
      try { payload.sizeVariants = JSON.parse(payload.sizeVariants); } catch (e) { payload.sizeVariants = []; }
    }
    if (payload.sizes) payload.sizes = parseArray(payload.sizes);
    if (payload.ages) payload.ages = parseArray(payload.ages);
    if (payload.colors) payload.colors = parseArray(payload.colors);
    if (payload.tags) payload.tags = parseArray(payload.tags);
    if (payload.paymentMethodAllowed) {
      const pMethod = payload.paymentMethodAllowed;
      payload.paymentMethodsAllowed = pMethod === "COD_Only"
        ? ["COD"]
        : pMethod === "Online_Only"
        ? ["Online"]
        : ["COD", "Online"];
    }

    if (Array.isArray(payload.sizeVariants) && payload.sizeVariants.length > 0) {
      if (!payload.sizes || payload.sizes.length === 0) {
        payload.sizes = payload.sizeVariants.map(v => v.size).filter(Boolean);
      }
      const validPrices = payload.sizeVariants.map(v => Number(v.price)).filter(p => !isNaN(p) && p > 0);
      if ((!payload.price || Number(payload.price) === 0) && validPrices.length > 0) {
        payload.price = Math.min(...validPrices);
      }
      const validMrps = payload.sizeVariants.map(v => Number(v.mrp)).filter(m => !isNaN(m) && m > 0);
      if ((!payload.mrp || Number(payload.mrp) === 0) && validMrps.length > 0) {
        payload.mrp = Math.min(...validMrps);
      }
      if (payload.stock === undefined || Number(payload.stock) === 0) {
        payload.stock = payload.sizeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    }

    const product = new Product(payload);
    const savedProduct = await product.save();

    console.log("New Product Added! Product ID:", savedProduct._id);

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updates = { ...req.body };
    if (typeof updates.sizeVariants === "string") {
      try { updates.sizeVariants = JSON.parse(updates.sizeVariants); } catch (e) { updates.sizeVariants = []; }
    }
    if (updates.sizes !== undefined) updates.sizes = parseArray(updates.sizes);
    if (updates.ages !== undefined) updates.ages = parseArray(updates.ages);
    if (updates.colors !== undefined) updates.colors = parseArray(updates.colors);
    if (updates.tags !== undefined) updates.tags = parseArray(updates.tags);
    if (updates.paymentMethodAllowed !== undefined) {
      const pMethod = updates.paymentMethodAllowed;
      updates.paymentMethodsAllowed = pMethod === "COD_Only"
        ? ["COD"]
        : pMethod === "Online_Only"
        ? ["Online"]
        : ["COD", "Online"];
    }

    if (Array.isArray(updates.sizeVariants) && updates.sizeVariants.length > 0) {
      if (!updates.sizes || updates.sizes.length === 0) {
        updates.sizes = updates.sizeVariants.map(v => v.size).filter(Boolean);
      }
      const validPrices = updates.sizeVariants.map(v => Number(v.price)).filter(p => !isNaN(p) && p > 0);
      if ((!updates.price || Number(updates.price) === 0) && validPrices.length > 0) {
        updates.price = Math.min(...validPrices);
      }
      const validMrps = updates.sizeVariants.map(v => Number(v.mrp)).filter(m => !isNaN(m) && m > 0);
      if ((!updates.mrp || Number(updates.mrp) === 0) && validMrps.length > 0) {
        updates.mrp = Math.min(...validMrps);
      }
      if (updates.stock === undefined || Number(updates.stock) === 0) {
        updates.stock = updates.sizeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    }

    Object.assign(product, updates);
    await product.save();

    res.json(product);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};