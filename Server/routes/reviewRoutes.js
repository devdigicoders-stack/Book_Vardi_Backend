import express from "express";
import {
  addReview,
  getProductReviews,
  deleteReview
} from "../controllers/reviewController.js";
import { protectUser } from "../middlewares/auth.js";

const router = express.Router();

// Public: Get reviews for a product
router.get("/product/:productId", getProductReviews);

// Customer: Add or update review
router.post("/", protectUser, addReview);

// Customer/Admin: Delete review
router.delete("/:id", protectUser, deleteReview);

export default router;
