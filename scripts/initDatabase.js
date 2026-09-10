import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../Server/models/Admin.js';
import User from '../Server/models/User.js';
import Category from '../Server/models/Category.js';
import Product from '../Server/models/Product.js';
import DeliveryBoy from '../Server/models/DeliveryBoy.js';
import Store from '../Server/models/Store.js';

dotenv.config();

const initDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb+srv://sv575014_db2:cP5Kp%233BFiJyi2-@cluster0.gxefepr.mongodb.net/admin_panel?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log('Connected to MongoDB');

    // Create default admin
    const existingAdmin = await Admin.findOne({ email: 'admin@admin.com' });
    if (!existingAdmin) {
      const admin = new Admin({
        name: 'Admin',
        email: 'admin@admin.com',
        password: 'admin123'
      });
      await admin.save();
      console.log('Default admin created: admin@admin.com / admin123');
    }

    // Create sample categories
    const categories = [
      { name: 'Milk', description: 'Fresh dairy milk products' },
      { name: 'Dahi', description: 'Yogurt and curd products' },
      { name: 'Ghee', description: 'Pure clarified butter' },
      { name: 'Buttermilk', description: 'Traditional buttermilk' },
      { name: 'Cheese', description: 'Various cheese products' },
      { name: 'Cream', description: 'Fresh cream products' }
    ];

    for (const cat of categories) {
      const existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        await Category.create(cat);
        console.log(`Category created: ${cat.name}`);
      }
    }

    // Create sample products
    const products = [
      { name: 'Fresh Milk', category: 'milk', price: 30, stock: 100, unit: 'liter' },
      { name: 'Greek Yogurt', category: 'dahi', price: 120, stock: 50, unit: 'kg' },
      { name: 'Pure Ghee', category: 'ghee', price: 800, stock: 25, unit: 'kg' },
      { name: 'Buttermilk', category: 'buttermilk', price: 25, stock: 75, unit: 'liter' },
      { name: 'Paneer', category: 'cheese', price: 300, stock: 30, unit: 'kg' },
      { name: 'Heavy Cream', category: 'cream', price: 150, stock: 40, unit: 'liter' }
    ];

    for (const prod of products) {
      const existing = await Product.findOne({ name: prod.name });
      if (!existing) {
        await Product.create(prod);
        console.log(`Product created: ${prod.name}`);
      }
    }

    // Create sample delivery boys
    const deliveryBoys = [
      { name: 'Raj Kumar', phone: '9876543210', status: 'active', orders: 15 },
      { name: 'Amit Singh', phone: '9876543211', status: 'active', orders: 12 },
      { name: 'Suresh Yadav', phone: '9876543212', status: 'inactive', orders: 8 }
    ];

    for (const boy of deliveryBoys) {
      const existing = await DeliveryBoy.findOne({ phone: boy.phone });
      if (!existing) {
        await DeliveryBoy.create(boy);
        console.log(`Delivery boy created: ${boy.name}`);
      }
    }

    // Create sample stores
    const stores = [
      { name: 'Main Store', location: 'Downtown', manager: 'John Smith', phone: '9876543210', status: 'active' },
      { name: 'Branch Store', location: 'Mall Road', manager: 'Jane Doe', phone: '9876543211', status: 'active' },
      { name: 'Outlet Store', location: 'City Center', manager: 'Bob Wilson', phone: '9876543212', status: 'inactive' }
    ];

    for (const store of stores) {
      const existing = await Store.findOne({ name: store.name });
      if (!existing) {
        await Store.create(store);
        console.log(`Store created: ${store.name}`);
      }
    }

    // Create sample users
    const users = [
      { name: 'John Doe', email: 'john@example.com', role: 'user', status: 'active' },
      { name: 'Jane Smith', email: 'jane@example.com', role: 'user', status: 'active' },
      { name: 'Bob Johnson', email: 'bob@example.com', role: 'user', status: 'inactive' }
    ];

    for (const user of users) {
      const existing = await User.findOne({ email: user.email });
      if (!existing) {
        await User.create(user);
        console.log(`User created: ${user.name}`);
      }
    }

    console.log('Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
};

initDatabase();