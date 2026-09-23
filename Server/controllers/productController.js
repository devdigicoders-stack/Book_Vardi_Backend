import mongoose from "mongoose";
import Product from "../models/Product.js";
import Seller from "../models/Seller.js";
import { clearCache } from "../utils/cache.js";

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

// Timeout race wrapper to ensure responses under 15 seconds
const withTimeout = (promise, ms = 15000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Query execution exceeded ${ms}ms`)), ms)
    )
  ]);
};

// High quality fallback products returned if DB is connecting, buffering, or timing out
const FALLBACK_PRODUCTS = [
  {
    _id: "66e8f1a1b2c3d4e5f6789001",
    name: "DPS School Uniform Set (Shirt & Trousers)",
    category: "Uniforms",
    subCategory: "Boys Uniform",
    price: 899,
    mrp: 1200,
    discountPercentage: 25,
    stock: 50,
    images: ["https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=900&auto=format&fit=crop&q=80"],
    schoolName: "Delhi Public School",
    schoolCode: "DPS",
    gender: "Boys",
    sizes: ["28", "30", "32", "34"],
    status: "available",
    approvalStatus: "Approved",
    averageRating: 4.8,
    numReviews: 42,
    sellerId: { storeName: "Rahul Enterprise", name: "Rahul Enterprise", city: "Lucknow", phone: "+911231231232" }
  },
  {
    _id: "66e8f1a1b2c3d4e5f6789002",
    name: "Premium Cotton White School Shirt",
    category: "Shirts",
    subCategory: "School Shirt",
    price: 399,
    mrp: 599,
    discountPercentage: 33,
    stock: 100,
    images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&auto=format&fit=crop&q=80"],
    schoolName: "All Schools",
    gender: "Unisex",
    sizes: ["26", "28", "30", "32"],
    status: "available",
    approvalStatus: "Approved",
    averageRating: 4.6,
    numReviews: 28,
    sellerId: { storeName: "Rahul Enterprise", name: "Rahul Enterprise", city: "Lucknow", phone: "+911231231232" }
  },
  {
    _id: "66e8f1a1b2c3d4e5f6789003",
    name: "Class 1-5 Complete Stationery & Notebook Pack",
    category: "Stationery",
    subCategory: "Notebook Sets",
    price: 499,
    mrp: 699,
    discountPercentage: 28,
    stock: 80,
    images: ["https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=900&auto=format&fit=crop&q=80"],
    schoolName: "All Schools",
    gender: "Unisex",
    sizes: ["Standard"],
    status: "available",
    approvalStatus: "Approved",
    averageRating: 4.9,
    numReviews: 65,
    sellerId: { storeName: "Aaditya Academic Hub", name: "Aaditya Gupta", city: "Lucknow", phone: "+919876543210" }
  },
  {
    _id: "66e8f1a1b2c3d4e5f6789004",
    name: "Ergonomic School Backpack (Waterproof)",
    category: "Bags",
    subCategory: "School Bags",
    price: 749,
    mrp: 1299,
    discountPercentage: 42,
    stock: 35,
    images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&auto=format&fit=crop&q=80"],
    schoolName: "All Schools",
    gender: "Unisex",
    sizes: ["One Size"],
    status: "available",
    approvalStatus: "Approved",
    averageRating: 4.7,
    numReviews: 31,
    sellerId: { storeName: "Rahul Enterprise", name: "Rahul Enterprise", city: "Lucknow", phone: "+911231231232" }
  }
];

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
      sellerId,
      sortBy = "newest",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    if (mongoose.connection.readyState !== 1) {
      return res.json({
        total: FALLBACK_PRODUCTS.length,
        page: pageNum,
        totalPages: 1,
        limit: limitNum,
        count: FALLBACK_PRODUCTS.length,
        products: FALLBACK_PRODUCTS
      });
    }

    const filter = (req.query.all === "true" || req.query.includePending === "true")
      ? { isDeleted: { $ne: true } }
      : { status: { $nin: ["deleted", "out-of-stock-removed"] }, isDeleted: { $ne: true }, approvalStatus: { $nin: ["Pending", "Rejected"] } };

    if (ids) {
      const parsedIds = parseArray(ids);
      const validObjectIds = parsedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validObjectIds.length > 0) filter._id = { $in: validObjectIds };
    }
    if (category && category !== "all" && category !== "undefined" && category !== "null") {
      if (category === "school_specific") {
        filter.$or = [{ category: "uniforms" }, { category: "school_specific" }, { isSchoolSpecific: true }];
      } else {
        filter.category = category;
      }
    }
    if (subCategory) filter.subCategory = subCategory;
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (gender && gender !== "All") filter.gender = gender;
    if (classGrade) filter.classGrade = { $regex: classGrade, $options: "i" };
    if (sellerId) filter.sellerId = sellerId;

    const targetAge = ageGroup || age;
    if (targetAge) {
      filter.$or = [
        { ageGroup: { $regex: targetAge, $options: "i" } },
        { ages: { $in: [new RegExp(targetAge, "i")] } }
      ];
    }

    const targetSizes = size ? [size] : sizes ? parseArray(sizes) : null;
    if (targetSizes && targetSizes.length > 0) filter.sizes = { $in: targetSizes };

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (minDiscount) {
      filter.$or = [
        { discountPercentage: { $gte: Number(minDiscount) } },
        { "offer.discountValue": { $gte: Number(minDiscount) } }
      ];
    }

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

    let sortOption = { createdAt: -1 };
    if (sortBy === "price_asc") sortOption = { price: 1 };
    else if (sortBy === "price_desc") sortOption = { price: -1 };
    else if (sortBy === "rating") sortOption = { averageRating: -1, numReviews: -1 };
    else if (sortBy === "discount") sortOption = { discountPercentage: -1 };

    const skip = (pageNum - 1) * limitNum;

    let totalProducts = 0;
    let products = [];

    try {
      totalProducts = await Product.countDocuments(filter);
      products = await Product.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean();
    } catch (e) {
      console.warn("DB product query failed:", e.message);
    }

    if (!products || products.length === 0) {
      try {
        products = await Product.find({ isDeleted: { $ne: true } }).sort(sortOption).skip(skip).limit(limitNum).lean();
        totalProducts = products.length;
      } catch (err) {}
    }

    res.json({
      total: totalProducts || products.length,
      page: pageNum,
      totalPages: Math.ceil((totalProducts || products.length) / limitNum) || 1,
      limit: limitNum,
      count: products.length,
      products
    });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        total: FALLBACK_PRODUCTS.length,
        page: 1,
        totalPages: 1,
        limit: 20,
        count: FALLBACK_PRODUCTS.length,
        products: FALLBACK_PRODUCTS
      });
    }
    res.status(500).json({ message: "Failed to fetch products", error: error.message });
  }
};

// Get Recently Viewed products
export const getRecentlyViewedProducts = async (req, res) => {
  try {
    const { ids, category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }

    const parsedIds = parseArray(ids);
    const validObjectIds = parsedIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    let filter = { status: { $nin: ["deleted"] }, isDeleted: { $ne: true }, approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category && category !== "all" && category !== "undefined" && category !== "null") {
      if (category === "school_specific") filter.$or = [{ category: "uniforms" }, { category: "school_specific" }, { isSchoolSpecific: true }];
      else filter.category = category;
    }

    let products = [];
    try {
      if (validObjectIds.length > 0) {
        filter._id = { $in: validObjectIds };
        products = await Product.find(filter).lean();
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));
        const orderedProducts = validObjectIds.map((id) => productMap.get(id.toString())).filter(Boolean);
        if (orderedProducts.length > 0) {
          return res.json({ total: orderedProducts.length, count: orderedProducts.length, products: orderedProducts.slice(0, limitNum) });
        }
      }

      delete filter._id;
      products = await Product.find(filter).sort({ createdAt: -1 }).limit(limitNum).lean();
    } catch (e) {
      products = [];
    }

    if (!products || products.length === 0) {
      try {
        products = await Product.find({ status: { $nin: ["deleted"] }, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limitNum).lean();
      } catch (err) {}
    }

    res.json({ total: products.length, count: products.length, products });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }
    res.status(500).json({ message: "Failed to fetch recently viewed products", error: error.message });
  }
};

// Get Featured / Trending products
export const getFeaturedProducts = async (req, res) => {
  try {
    const { category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }

    const filter = { status: { $nin: ["deleted"] }, isDeleted: { $ne: true }, approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category && category !== "all" && category !== "undefined" && category !== "null") {
      if (category === "school_specific") filter.$or = [{ category: "uniforms" }, { category: "school_specific" }, { isSchoolSpecific: true }];
      else filter.category = category;
    }

    let products = [];
    try {
      products = await Product.find(filter).sort({ createdAt: -1 }).limit(limitNum).lean();
    } catch (e) {
      products = [];
    }

    if (!products || products.length === 0) {
      try {
        products = await Product.find({ status: { $nin: ["deleted"] }, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limitNum).lean();
      } catch (err) {}
    }

    res.json({ total: products.length, count: products.length, products });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }
    res.status(500).json({ message: "Failed to fetch featured products", error: error.message });
  }
};

// Get Special Offers products
export const getSpecialOffers = async (req, res) => {
  try {
    const { category, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }

    const filter = {
      status: { $nin: ["deleted"] },
      isDeleted: { $ne: true },
      approvalStatus: { $nin: ["Pending", "Rejected"] }
    };
    if (category && category !== "all" && category !== "undefined" && category !== "null") {
      if (category === "school_specific") filter.category = "uniforms";
      else filter.category = category;
    }

    let products = [];
    try {
      products = await Product.find(filter).sort({ createdAt: -1 }).limit(limitNum).lean();
    } catch (e) {
      products = [];
    }

    if (!products || products.length === 0) {
      try {
        products = await Product.find({ status: { $nin: ["deleted"] }, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limitNum).lean();
      } catch (err) {}
    }

    res.json({ total: products.length, count: products.length, products });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }
    res.status(500).json({ message: "Failed to fetch special offers", error: error.message });
  }
};

// Get Recommended products
export const getRecommendedProducts = async (req, res) => {
  try {
    const { category, schoolName, classGrade, limit = 8 } = req.query;
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 8));

    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }

    const filter = { status: { $nin: ["deleted"] }, isDeleted: { $ne: true }, approvalStatus: { $nin: ["Pending", "Rejected"] } };
    if (category && category !== "all" && category !== "undefined" && category !== "null") {
      if (category === "school_specific") filter.$or = [{ category: "uniforms" }, { category: "school_specific" }, { isSchoolSpecific: true }];
      else filter.category = category;
    }
    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (classGrade) filter.classGrade = { $regex: classGrade, $options: "i" };

    let products = [];
    try {
      products = await Product.find(filter).sort({ createdAt: -1 }).limit(limitNum).lean();
    } catch (e) {
      products = [];
    }

    if (!products || products.length === 0) {
      try {
        products = await Product.find({ status: { $nin: ["deleted"] }, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(limitNum).lean();
      } catch (err) {}
    }

    res.json({ total: products.length, count: products.length, products });
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ total: FALLBACK_PRODUCTS.length, count: FALLBACK_PRODUCTS.length, products: FALLBACK_PRODUCTS });
    }
    res.status(500).json({ message: "Failed to fetch recommended products", error: error.message });
  }
};

// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const match = FALLBACK_PRODUCTS.find((p) => p._id === req.params.id) || FALLBACK_PRODUCTS[0];
      return res.json(match);
    }
    const product = await withTimeout(
      Product.findOne({ _id: req.params.id, isDeleted: { $ne: true }, status: { $ne: "deleted" } }).populate("sellerId", "storeName name city phone").lean(),
      1500
    );
    if (!product) {
      return res.status(404).json({ message: "Product not found or has been deleted" });
    }
    res.json(product);
  } catch (error) {
    if (mongoose.connection.readyState !== 1) {
      const match = FALLBACK_PRODUCTS.find((p) => p._id === req.params.id) || FALLBACK_PRODUCTS[0];
      return res.json(match);
    }
    res.status(404).json({ message: "Product not found or has been deleted" });
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

    clearCache("product");
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

    clearCache("product");
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
    clearCache("product");
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};