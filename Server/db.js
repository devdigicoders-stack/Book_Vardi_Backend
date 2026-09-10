import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MongoUri);
    console.log("MongoDB Connected to adminpanel");
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
};