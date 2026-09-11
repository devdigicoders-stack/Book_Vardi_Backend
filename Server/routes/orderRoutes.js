import express from "express";
import {
  getOrders,
  getMyOrders,
  getOrderById,
  trackOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  downloadInvoice
} from "../controllers/orderController.js";
import { authenticateToken, protectUser, optionalUserAuth } from "../middlewares/auth.js";

const router = express.Router();

router.get("/my-orders", optionalUserAuth, getMyOrders);
router.get("/track/:orderId", trackOrder); // Public & User order tracking by Order ID
router.get("/:id/invoice", optionalUserAuth, downloadInvoice);
router.get("/", authenticateToken, getOrders);
router.get("/:id", authenticateToken, getOrderById);
router.post("/", optionalUserAuth, createOrder);
router.put("/:id", authenticateToken, updateOrder);
router.delete("/:id", authenticateToken, deleteOrder);

export default router;