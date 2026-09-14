import express from "express";
import {
  addReview,
  getProductReviews,
  updateReviewStatus,
  deleteReview
} from "../controllers/reviewController.js";
import { optionalUserAuth } from "../middlewares/auth.js";

const router = express.Router();

// Public: Get reviews for a product
router.get("/product/:productId", getProductReviews);

// Customer: Add or update review
router.post("/", optionalUserAuth, addReview);

// Seller/Admin: Approve or reject review
router.patch("/:id/status", optionalUserAuth, updateReviewStatus);

// Customer/Admin: Delete review
router.delete("/:id", optionalUserAuth, deleteReview);

export default router;
