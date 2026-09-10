import mongoose from "mongoose";
import Admin from "../Server/models/Admin.js";
import { connectDB } from "../config/db.js";

const fixLogin = async () => {
  try {
    console.log(" Fixing login issues...");
    
    // Connect to database
    await connectDB();
    console.log(" Database connected");
    
    // Remove existing admin if any
    await Admin.deleteMany({ email: "admin@admin.com" });
    console.log(" Cleared existing admin");
    
    // Create fresh admin
    const admin = new Admin({
      name: "Admin",
      email: "admin@admin.com",
      password: "admin123"
    });
    
    await admin.save();
    console.log(" Fresh admin created");
    
    // Verify admin
    const savedAdmin = await Admin.findOne({ email: "admin@admin.com" });
    if (savedAdmin) {
     
    } else {
      
    }
    
  } catch (error) {
    
  } finally {
    mongoose.connection.close();
  }
};

fixLogin();