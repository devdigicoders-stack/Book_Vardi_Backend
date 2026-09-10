import mongoose from "mongoose";

export const connectDB = async () => {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/schoolkart_db";

  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected successfully to:", uri.split("@").pop().split("?")[0]);
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
  }
};

export default connectDB;