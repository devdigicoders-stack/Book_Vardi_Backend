import mongoose from "mongoose";

export const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const localUri = "mongodb://127.0.0.1:27017/bookvardi_db_final";

  // Prevent Mongoose from buffering commands indefinitely when DB is connecting/offline
  mongoose.set("bufferCommands", false);

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      console.log("✅ MongoDB Connected successfully to Atlas:", primaryUri.split("@").pop().split("?")[0]);
      return;
    } catch (error) {
      console.warn("⚠️ MongoDB Atlas Connection Failed (" + error.message + "). Attempting local fallback...");
    }
  } else {
    console.warn("⚠️ MONGODB_URI environment variable is missing in process.env!");
  }

  try {
    await mongoose.connect(localUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    console.log("✅ MongoDB Connected successfully to Local DB:", localUri);
  } catch (error) {
    console.error("⚠️ MongoDB Connection Error:", error.message);
    console.warn("ℹ️ Server operating in offline mock mode.");
  }
};

export default connectDB;