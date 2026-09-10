import express from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  addAddress,
  deleteAddress,
  forgotPassword,
  resetPassword
} from "../controllers/userAuthController.js";
import { protectUser } from "../middlewares/auth.js";

const router = express.Router();

// Public auth routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes (Logged in customer)
router.get("/profile", protectUser, getUserProfile);
router.put("/profile", protectUser, updateUserProfile);
router.post("/addresses", protectUser, addAddress);
router.delete("/addresses/:addressId", protectUser, deleteAddress);

export default router;

