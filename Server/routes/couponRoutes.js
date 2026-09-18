import express from "express";
import {
  applyCoupon,
  getActiveCoupons,
  createCoupon,
  getAllCouponsAdmin,
  deleteCoupon
} from "../controllers/couponController.js";
import { authenticateAdmin } from "../middlewares/auth.js";

const router = express.Router();

// Public / Customer routes
router.post("/apply", applyCoupon);
router.get("/active", getActiveCoupons);

// Admin routes
router.get("/", getAllCouponsAdmin);
router.post("/", createCoupon);
router.delete("/:id", deleteCoupon);
router.get("/admin", authenticateAdmin, getAllCouponsAdmin);
router.post("/admin", authenticateAdmin, createCoupon);
router.delete("/admin/:id", authenticateAdmin, deleteCoupon);

export default router;
