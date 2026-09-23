import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Product from './Server/models/Product.js';

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bookvardi');
    console.log('MongoDB Connected');
    const total = await Product.countDocuments();
    const nonDeleted = await Product.countDocuments({ isDeleted: { $ne: true } });
    const notDeletedStatus = await Product.countDocuments({ status: { $nin: ['deleted', 'out-of-stock-removed'] } });
    const approvedOrNoStatus = await Product.countDocuments({ approvalStatus: { $nin: ['Pending', 'Rejected'] } });
    
    console.log('Product Statistics:', { total, nonDeleted, notDeletedStatus, approvedOrNoStatus });
    
    const sample = await Product.find().limit(5).select('name status approvalStatus isDeleted category price');
    console.log('Sample Products:', sample);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
