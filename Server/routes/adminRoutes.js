import express from "express";
import {
  loginAdmin,
  createAdmin,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDashboardStats,
  changePassword,
  getRecentActivities,
  getChartData,
  globalSearch
} from "../controllers/adminController.js";
import {
  getAllSellers,
  getSellerById,
  approveSeller,
  rejectSeller,
  toggleSellerStatus
} from "../controllers/adminSellerController.js";
import {
  getAllPayoutsAdmin,
  processPayoutAdmin
} from "../controllers/payoutController.js";
import {
  exportOrdersAdmin,
  exportProductsAdmin,
  exportUsersAdmin,
  exportSellersAdmin
} from "../controllers/exportController.js";
import { authenticateAdmin } from "../middlewares/auth.js";

const router = express.Router();

// ==========================================
// Admin Auth routes
// ==========================================
router.post("/login", loginAdmin);
router.post("/register", createAdmin);
router.post("/create-default", createAdmin);

// ==========================================
// Admin Dashboard & User Management
// ==========================================
router.get("/dashboard/stats", authenticateAdmin, getDashboardStats);
router.get("/recent-activities", authenticateAdmin, getRecentActivities);
router.get("/chart-data", authenticateAdmin, getChartData);
router.get("/users", authenticateAdmin, getUsers);
router.post("/users", authenticateAdmin, createUser);
router.put("/users/:id", authenticateAdmin, updateUser);
router.delete("/users/:id", authenticateAdmin, deleteUser);
router.put("/change-password", authenticateAdmin, changePassword);
router.get("/search", authenticateAdmin, globalSearch);

// ==========================================
// Admin Seller Verification & Management
// ==========================================
router.get("/sellers", authenticateAdmin, getAllSellers);
router.get("/sellers/:id", authenticateAdmin, getSellerById);
router.put("/sellers/:id/approve", authenticateAdmin, approveSeller);
router.put("/sellers/:id/reject", authenticateAdmin, rejectSeller);
router.put("/sellers/:id/status", authenticateAdmin, toggleSellerStatus);

// ==========================================
// Admin Payout Ledger & Approvals
// ==========================================
router.get("/payouts", authenticateAdmin, getAllPayoutsAdmin);
router.put("/payouts/:id/process", authenticateAdmin, processPayoutAdmin);

// ==========================================
// Admin Data Export (Excel / CSV Reports)
// ==========================================
router.get("/export/orders", authenticateAdmin, exportOrdersAdmin);
router.get("/export/products", authenticateAdmin, exportProductsAdmin);
router.get("/export/users", authenticateAdmin, exportUsersAdmin);
router.get("/export/sellers", authenticateAdmin, exportSellersAdmin);

export default router;


