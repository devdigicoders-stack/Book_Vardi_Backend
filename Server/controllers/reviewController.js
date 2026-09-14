import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

// 1. Add / Update Product Review
export const addReview = async (req, res) => {
  try {
    const { productId, rating, comment, title, images, userName, name, institution } = req.body;

    if (!productId || !rating || !comment) {
      return res.status(400).json({ message: "Product ID, rating (1-5), and comment are required" });
    }

    const userId =
      req.user?.id ||
      req.headers["x-user-id"] ||
      req.headers["x-user-phone"] ||
      req.body.phone ||
      req.body.userId ||
      `anon_${Date.now()}`;

    const displayName = userName || name || req.user?.name || "Verified Customer";
    const displayInstitution = institution || req.user?.institution || "Verified Customer";

    // Default status to pending for customer reviews, approved for seller/admin
    const initialStatus = (req.user?.role === "admin" || req.user?.role === "seller") ? "approved" : "pending";

    // Check if verified purchaser
    let hasPurchased = false;
    try {
      if (req.user?.id) {
        hasPurchased = !!(await Order.findOne({
          userId: req.user.id,
          "items.productId": productId,
          overallStatus: { $in: ["delivered", "completed", "shipped"] }
        }));
      }
    } catch (e) {}

    // Check if review already exists
    let review = await Review.findOne({
      $or: [
        { productId: productId, userId: userId },
        { productId: String(productId), userId: String(userId) }
      ]
    });

    if (review) {
      review.rating = Number(rating);
      review.comment = comment;
      review.title = title || review.title || "";
      review.userName = displayName;
      review.institution = displayInstitution;
      if (images) review.images = images;
      review.verifiedPurchase = hasPurchased;
      review.status = initialStatus;
      await review.save();
    } else {
      review = await Review.create({
        productId,
        userId,
        userName: displayName,
        institution: displayInstitution,
        rating: Number(rating),
        title: title || "",
        comment,
        images: images || [],
        verifiedPurchase: hasPurchased,
        status: initialStatus
      });
    }

    const formattedReview = {
      id: review._id,
      name: review.userName,
      institution: review.institution || "Verified Customer",
      rating: review.rating,
      date: "Just now",
      title: review.title || "",
      comment: review.comment,
      images: review.images || [],
      verifiedPurchase: review.verifiedPurchase,
      status: review.status,
      helpfulCount: 0,
      createdAt: review.createdAt
    };

    res.status(201).json({
      message: "Review submitted successfully and sent for seller approval",
      review: formattedReview
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit review", error: error.message });
  }
};

// 2. Get Reviews for a Product (Public endpoint returns ONLY seller-approved reviews)
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const includePending = req.query.includePending === "true";

    const productQuery = [
      { productId: productId },
      { productId: String(productId) }
    ];
    if (!isNaN(productId)) {
      productQuery.push({ productId: Number(productId) });
    }

    let filter = { $or: productQuery };

    // Unless explicitly requesting pending reviews, filter to return only seller-approved reviews
    if (!includePending) {
      filter = {
        $and: [
          { $or: productQuery },
          { $or: [{ status: "approved" }, { status: { $exists: false } }] }
        ]
      };
    }

    const reviews = await Review.find(filter).sort({ createdAt: -1 });

    const formattedReviews = reviews.map((r) => ({
      id: r._id,
      name: r.userName || "Verified Customer",
      institution: r.institution || "Verified Customer",
      rating: r.rating,
      date: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recently",
      title: r.title || "",
      comment: r.comment,
      images: r.images || [],
      verifiedPurchase: r.verifiedPurchase || false,
      status: r.status || "approved",
      helpfulCount: 0,
      createdAt: r.createdAt
    }));

    res.json(formattedReviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews", error: error.message });
  }
};

// 3. Update Review Approval Status (Seller or Admin Approval)
export const updateReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' | 'rejected' | 'pending'

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved', 'rejected', or 'pending'" });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.status = status;
    await review.save();

    // Recalculate rating on product for approved reviews
    try {
      const productId = review.productId;
      const approvedReviews = await Review.find({
        $or: [{ productId: productId }, { productId: String(productId) }],
        $or: [{ status: "approved" }, { status: { $exists: false } }]
      });

      const avgRating =
        approvedReviews.length > 0
          ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
          : 0;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(avgRating * 10) / 10,
        numReviews: approvedReviews.length
      });
    } catch (e) {}

    res.json({ message: `Review status updated to ${status}`, review });
  } catch (error) {
    res.status(500).json({ message: "Failed to update review status", error: error.message });
  }
};

// 4. Delete Review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const requesterId = req.user?.id || req.headers["x-user-id"] || req.headers["x-user-phone"];
    if (requesterId && review.userId.toString() !== requesterId.toString() && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this review" });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(req.params.id);

    // Recalculate rating
    try {
      const allReviews = await Review.find({
        $or: [{ productId: productId }, { productId: String(productId) }],
        $or: [{ status: "approved" }, { status: { $exists: false } }]
      });
      const avgRating =
        allReviews.length > 0
          ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
          : 0;

      await Product.findByIdAndUpdate(productId, {
        averageRating: Math.round(avgRating * 10) / 10,
        numReviews: allReviews.length
      });
    } catch (e) {}

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete review", error: error.message });
  }
};

// 5. Get All Reviews for Logged-in Seller's Products
export const getSellerReviews = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const sellerProducts = await Product.find({ sellerId }).select("_id name images");
    const productIds = sellerProducts.map(p => p._id);

    const reviews = await Review.find({
      $or: [
        { productId: { $in: productIds } },
        { sellerId: sellerId }
      ]
    }).sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller reviews", error: error.message });
  }
};

// 6. Post Official Seller Reply to Customer Review
export const replyToSellerReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyText, reply } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.reply = replyText || reply || "";
    review.repliedAt = new Date();
    await review.save();

    res.json({ success: true, message: "Reply added to customer review", review });
  } catch (error) {
    res.status(500).json({ message: "Failed to post review reply", error: error.message });
  }
};
