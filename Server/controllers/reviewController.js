import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

// 1. Add / Update Product Review
export const addReview = async (req, res) => {
  try {
    const { productId, rating, comment, images } = req.body;

    if (!productId || !rating || !comment) {
      return res.status(400).json({ message: "Product ID, rating (1-5), and comment are required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if verified purchaser
    const hasPurchased = await Order.findOne({
      userId: req.user.id,
      "items.productId": productId,
      overallStatus: { $in: ["delivered", "completed", "shipped"] }
    });

    // Check if review already exists
    let review = await Review.findOne({ productId, userId: req.user.id });

    if (review) {
      review.rating = Number(rating);
      review.comment = comment;
      if (images) review.images = images;
      review.verifiedPurchase = !!hasPurchased;
      await review.save();
    } else {
      review = await Review.create({
        productId,
        userId: req.user.id,
        userName: req.user.name || "Customer",
        rating: Number(rating),
        comment,
        images: images || [],
        verifiedPurchase: !!hasPurchased
      });
    }

    // Recalculate product average rating & review count
    const allReviews = await Review.find({ productId });
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / (allReviews.length || 1);

    product.averageRating = Math.round(avgRating * 10) / 10;
    product.numReviews = allReviews.length;
    await product.save();

    res.status(201).json({
      message: "Review submitted successfully",
      review,
      productRating: {
        averageRating: product.averageRating,
        numReviews: product.numReviews
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit review", error: error.message });
  }
};

// 2. Get Reviews for a Product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await Review.find({ productId })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews", error: error.message });
  }
};

// 3. Delete Review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.userId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(req.params.id);

    // Recalculate rating
    const allReviews = await Review.find({ productId });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(avgRating * 10) / 10,
      numReviews: allReviews.length
    });

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete review", error: error.message });
  }
};
