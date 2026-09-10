import express from "express";
import {
  registerSeller,
  loginSeller,
  getSellerProfile,
  updateSellerProfile,
  getNearbySellers
} from "../controllers/sellerAuthController.js";
import {
  getSellerProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  setProductOffer,
  removeProductOffer
} from "../controllers/sellerProductController.js";
import {
  getSellerKits,
  getSellerKitById,
  createKit,
  updateKit,
  deleteKit
} from "../controllers/sellerKitController.js";
import {
  getSellerOrders,
  updateSellerOrderItemStatus,
  downloadSellerInvoice
} from "../controllers/sellerOrderController.js";
import {
  getSellerOffers,
  createSellerOffer,
  updateSellerOffer,
  deleteSellerOffer
} from "../controllers/sellerOfferController.js";
import {
  getSellerWalletOverview,
  requestPayout
} from "../controllers/payoutController.js";
import { exportSellerOrders } from "../controllers/exportController.js";
import { uploadSellerDocs, uploadProductImages } from "../middlewares/upload.js";
import { authenticateSeller } from "../middlewares/auth.js";

const router = express.Router();

// ==========================================
// 1. Public & Location-based Routes
// ==========================================
// Nearby Sellers Search (by customer lat/lng)
router.get("/nearby", getNearbySellers);

// ==========================================
// 2. Seller Authentication & Profile
// ==========================================
// Seller Registration with KYC Documents upload & Location
router.post("/register", uploadSellerDocs, registerSeller);

// Seller Login (Only Approved Sellers)
router.post("/login", loginSeller);

// Protected Seller Profile
router.get("/profile", authenticateSeller, getSellerProfile);
router.put("/profile", authenticateSeller, updateSellerProfile);

// ==========================================
// 3. Seller Single Product Management & Offers
// ==========================================
router.get("/products", authenticateSeller, getSellerProducts);
router.post("/products", authenticateSeller, uploadProductImages, createProduct);
router.put("/products/:id", authenticateSeller, uploadProductImages, updateProduct);
router.delete("/products/:id", authenticateSeller, deleteProduct);

// Per-Product Specific Offer Management
router.post("/products/:id/offer", authenticateSeller, setProductOffer);
router.delete("/products/:id/offer", authenticateSeller, removeProductOffer);

// ==========================================
// 4. Seller Complete Uniform Kit Bundles
// ==========================================
router.get("/kits", authenticateSeller, getSellerKits);
router.get("/kits/:id", authenticateSeller, getSellerKitById);
router.post("/kits", authenticateSeller, uploadProductImages, createKit);
router.put("/kits/:id", authenticateSeller, uploadProductImages, updateKit);
router.delete("/kits/:id", authenticateSeller, deleteKit);

// ==========================================
// 5. Seller Order Management
// ==========================================
router.get("/orders", authenticateSeller, getSellerOrders);
router.get("/orders/export", authenticateSeller, exportSellerOrders);
router.get("/orders/:orderId/invoice", authenticateSeller, downloadSellerInvoice);
router.put(
  "/orders/:orderId/items/:itemId/status",
  authenticateSeller,
  updateSellerOrderItemStatus
);

// ==========================================
// 6. Seller Store-wide Coupons & Offers
// ==========================================
router.get("/offers", authenticateSeller, getSellerOffers);
router.post("/offers", authenticateSeller, createSellerOffer);
router.put("/offers/:id", authenticateSeller, updateSellerOffer);
router.delete("/offers/:id", authenticateSeller, deleteSellerOffer);

// ==========================================
// 7. Seller Financials, Wallet & Payout Ledger
// ==========================================
router.get("/wallet", authenticateSeller, getSellerWalletOverview);
router.post("/payout-request", authenticateSeller, requestPayout);

export default router;

