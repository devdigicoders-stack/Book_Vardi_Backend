import mongoose from "mongoose";
import Admin from "../Server/models/Admin.js";
import { connectDB } from "../config/db.js";

const initAdmin = async () => {
  try {
    await connectDB();
    
    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email: "admin@admin.com" });
    
    if (existingAdmin) {
    
      return;
    }

    // Create default admin
    const admin = new Admin({
      name: "Admin",
      email: "admin@admin.com",
      password: "admin123"
    });

    await admin.save();
    // console.log("✅ Default admin created successfully!");
    // console.log("📧 Email: admin@admin.com");
    // console.log("🔑 Password: admin123");
    
  } catch (error) {
    // console.error("❌ Error:", error.message);
  } finally {
    mongoose.connection.close();
  }
};

initAdmin();