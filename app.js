import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Ensure all upload directories exist on server startup
["uploads", "uploads/avatars", "uploads/documents", "uploads/products"].forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});


// Models & initial setup
import Admin from "./Server/models/Admin.js";
import bcrypt from "bcryptjs";

// Routes
import adminRoutes from "./Server/routes/adminRoutes.js";
import sellerRoutes from "./Server/routes/sellerRoutes.js";
import productRoutes from "./Server/routes/productRoutes.js";
import kitRoutes from "./Server/routes/kitRoutes.js";
import categoryRoutes from "./Server/routes/categoryRoutes.js";
import orderRoutes from "./Server/routes/orderRoutes.js";
import paymentRoutes from "./Server/routes/paymentRoutes.js";
import deliveryRoutes from "./Server/routes/deliveryRoutes.js";
import storeRoutes from "./Server/routes/storeRoutes.js";
import userRoutes from "./Server/routes/userRoutes.js";
import cartRoutes from "./Server/routes/cartRoutes.js";
import wishlistRoutes from "./Server/routes/wishlistRoutes.js";
import couponRoutes from "./Server/routes/couponRoutes.js";
import reviewRoutes from "./Server/routes/reviewRoutes.js";
import schoolRoutes from "./Server/routes/schoolRoutes.js";

import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { seedDatabaseIfEmpty } from "./Server/config/autoSeed.js";

dotenv.config();

const app = express();

// 1. Connect to MongoDB
connectDB().then(() => {
  seedDatabaseIfEmpty();
}).catch(() => {});


// 2. Create Default Admin if doesn't exist
const initDefaultAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ email: "admin@admin.com" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await Admin.create({
        name: "Super Admin",
        email: "admin@admin.com",
        password: hashedPassword
      });
      console.log("Default admin created: admin@admin.com / admin123");
    }
  } catch (error) {
    console.error("Default admin creation error:", error.message);
  }
};
initDefaultAdmin();

// 3. Security Middlewares (Helmet & Rate Limiting)
app.use(helmet({ crossOriginResourcePolicy: false })); // Secure HTTP Headers
app.use(cors());

// Global Rate Limiter: 500 requests per 15 mins
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again after 15 minutes." }
});
app.use("/api", globalLimiter);

// Strict Auth / Sensitive Rate Limiter: 30 attempts per 15 mins for login / register / OTP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login/auth attempts, please try again later." }
});
app.use("/api/users/login", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/users/forgot-password", authLimiter);
app.use("/api/seller/login", authLimiter);
app.use("/api/admin/login", authLimiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 4. Serve Static Uploads (Documents & Product Images)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  setHeaders: (res, filePath) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (filePath.toLowerCase().endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
    }
  }
}));

// 5. API Routes
app.use("/api/admin", adminRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/products", productRoutes);
app.use("/api/kits", kitRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/schools", schoolRoutes);

// 6. Health & Status Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    service: "SchoolKart Multi-Vendor Backend API",
    timestamp: new Date().toISOString()
  });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

export default app;
