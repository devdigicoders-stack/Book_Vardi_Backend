import express from "express";
import {
  getProducts,
  getRecentlyViewedProducts,
  getFeaturedProducts,
  getSpecialOffers,
  getRecommendedProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from "../controllers/productController.js";
import { authenticateToken } from "../middlewares/auth.js";

const router = express.Router();

// Carousel Special Endpoints (must come before /:id)
router.get("/recently-viewed", getRecentlyViewedProducts);
router.get("/featured", getFeaturedProducts);
router.get("/special-offers", getSpecialOffers);
router.get("/recommended", getRecommendedProducts);

// Publicly browse products
router.get("/", getProducts);
router.get("/:id", getProductById);

// Admin / Authenticated endpoints
router.post("/", authenticateToken, createProduct);
router.put("/:id", authenticateToken, updateProduct);
router.delete("/:id", authenticateToken, deleteProduct);

export default router;