import mongoose from "mongoose";
import Admin from "../Server/models/Admin.js";
import { connectDB } from "../config/db.js";

const createDefaultAdmin = async () => {
  try {
    await connectDB();
    
    const existingAdmin = await Admin.findOne({ email: "admin@admin.com" });
    
    if (existingAdmin) {
      console.log("Default admin already exists");
      return;
    }

    const admin = new Admin({
      name: "Admin",
      email: "admin@admin.com",
      password: "admin123"
    });

    await admin.save();
    console.log("Default admin created successfully");
    console.log("Email: admin@admin.com");
    console.log("Password: admin123");
    
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    mongoose.connection.close();
  }
};

createDefaultAdmin();