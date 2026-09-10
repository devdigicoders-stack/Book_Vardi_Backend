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

// Get all products (with optional filtering by category, search, school, size, age, discount, offer)
export const getProducts = async (req, res) => {
  try {
    const {
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

    const filter = { status: "available" };

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
    else if (sortBy === "rating") sortOption = { averageRating: -1 };
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
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch product", error: error.message });
  }
};

// Create new product (Admin / General)
export const createProduct = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.sizes) payload.sizes = parseArray(payload.sizes);
    if (payload.ages) payload.ages = parseArray(payload.ages);
    if (payload.colors) payload.colors = parseArray(payload.colors);
    if (payload.tags) payload.tags = parseArray(payload.tags);

    const product = new Product(payload);
    const savedProduct = await product.save();
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
    if (updates.sizes !== undefined) updates.sizes = parseArray(updates.sizes);
    if (updates.ages !== undefined) updates.ages = parseArray(updates.ages);
    if (updates.colors !== undefined) updates.colors = parseArray(updates.colors);
    if (updates.tags !== undefined) updates.tags = parseArray(updates.tags);

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