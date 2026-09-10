import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../Server/models/Admin.js';

dotenv.config();

const createDefaultAdmin = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('Connected to MongoDB');

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ email: 'admin@admin.com' });
    if (existingAdmin) {
      console.log('Admin already exists: admin@admin.com');
    } else {
      // Create default admin
      const admin = new Admin({
        name: 'Admin',
        email: 'admin@admin.com',
        password: 'admin123'
      });
      await admin.save();
      console.log('Default admin created: admin@admin.com / admin123');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createDefaultAdmin();