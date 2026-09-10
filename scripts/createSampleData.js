import mongoose from "mongoose";
import User from "../Server/models/User.js";
import { connectDB } from "../config/db.js";

const createSampleUsers = async () => {
  try {
    await connectDB();
    
    const sampleUsers = [
      {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        status: "active"
      },
      {
        name: "Jane Smith",
        email: "jane@example.com",
        role: "user",
        status: "active"
      },
      {
        name: "Bob Johnson",
        email: "bob@example.com",
        role: "user",
        status: "inactive"
      }
    ];

    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const user = new User(userData);
        await user.save();
        console.log(`Created user: ${userData.name}`);
      }
    }

    console.log("Sample users created successfully");
    
  } catch (error) {
    console.error("Error creating sample users:", error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleUsers();