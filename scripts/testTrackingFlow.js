import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import Admin from "../Server/models/Admin.js";
import Seller from "../Server/models/Seller.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

const PORT = 5093;

async function testOrderTrackingFlow() {
  console.log("==================================================");
  console.log("📍 TESTING ENTERPRISE ORDER LIFECYCLE & LIVE TRACKING");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once("open", resolve));
  }

  const BASE_URL = `http://localhost:${PORT}/api`;

  const request = async (url, options = {}) => {
    const res = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  };

  try {
    // 1. ADMIN LOGIN
    console.log("\n--- STEP 1: Admin Login ---");
    const adminLoginRes = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@admin.com",
        password: "admin123"
      })
    });
    if (!adminLoginRes.ok) throw new Error("Admin login failed");
    const adminToken = adminLoginRes.data.token;
    console.log("✔ Admin Logged In with JWT Token");

    // 2. CREATE A SAMPLE PRODUCT & ORDER
    console.log("\n--- STEP 2: Place Order (Initial Status: 'placed') ---");
    const testProduct = await Product.create({
      name: "Class 10 CBSE Complete NCERT Book Set",
      category: "Books",
      price: 2400,
      stock: 30
    });

    const createOrderRes = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: { name: "Aditya Roy", phone: "9876543210", email: "aditya@test.com" },
        items: [
          {
            productId: testProduct._id.toString(),
            name: testProduct.name,
            price: 2400,
            quantity: 1,
            total: 2400
          }
        ],
        totalAmount: 2400,
        paymentMethod: "Razorpay",
        paymentStatus: "paid",
        shippingAddress: {
          street: "House 102, Indira Nagar",
          city: "Lucknow",
          state: "UP",
          pincode: "226016"
        }
      })
    });

    if (!createOrderRes.ok) throw new Error("Order creation failed");
    const order = createOrderRes.data.order;
    console.log(`✔ Order Created: ID=${order._id} (Order Number: ${order.orderId})`);
    console.log(`✔ Initial Status: ${order.overallStatus.toUpperCase()}`);

    // 3. SELLER / ADMIN UPDATES STATUS THROUGH LIFECYCLE
    console.log("\n--- STEP 3: Progressing Order Lifecycle ---");

    // A: Confirmed
    await request(`/orders/${order._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        overallStatus: "confirmed",
        statusLocation: "Lucknow Central Hub"
      })
    });
    console.log("✔ Step 2: Marked as CONFIRMED");

    // B: Packed
    await request(`/orders/${order._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        overallStatus: "packed",
        statusLocation: "Lucknow Warehouse #2"
      })
    });
    console.log("✔ Step 3: Marked as PACKED");

    // C: Shipped
    await request(`/orders/${order._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        overallStatus: "shipped",
        statusDescription: "Package dispatched via Express Logistics.",
        statusLocation: "Gomti Nagar Sorting Hub"
      })
    });
    console.log("✔ Step 4: Marked as SHIPPED");

    // D: Out for Delivery
    await request(`/orders/${order._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        overallStatus: "out_for_delivery",
        statusDescription: "Delivery executive (Mohan - 9876501234) is out for delivery.",
        statusLocation: "Indira Nagar Local Delivery Center"
      })
    });
    console.log("✔ Step 5: Marked as OUT FOR DELIVERY");

    // 4. CUSTOMER TRACKS ORDER VIA ORDER ID
    console.log("\n--- STEP 4: Customer Checks Live Tracking Screen ---");
    const trackRes = await request(`/orders/track/${order.orderId}`);

    if (!trackRes.ok) {
      throw new Error(`Tracking API failed: ${JSON.stringify(trackRes.data)}`);
    }

    const tracking = trackRes.data;
    console.log(`✔ Track API Success!`);
    console.log(`✔ Current Status: ${tracking.currentStatus.toUpperCase()}`);
    console.log(`✔ Active Stepper Progress: Step ${tracking.currentStepIndex + 1} of ${tracking.steps.length}`);
    console.log(`✔ Total Timeline History Events: ${tracking.timeline.length}`);

    console.log("\n--- Detailed Timeline Events Logged ---");
    tracking.timeline.forEach((event, idx) => {
      console.log(`  [${idx + 1}] ${new Date(event.timestamp).toLocaleTimeString()} - ${event.title} (${event.status}) -> ${event.description} ${event.location ? "@ " + event.location : ""}`);
    });

    // 5. MARK AS DELIVERED
    console.log("\n--- STEP 5: Delivery Confirmation (Final Status: 'delivered') ---");
    await request(`/orders/${order._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        overallStatus: "delivered",
        statusDescription: "Order successfully delivered and handed over to Aditya Roy.",
        statusLocation: "Indira Nagar, Lucknow"
      })
    });

    const finalTrackRes = await request(`/orders/track/${order.orderId}`);
    if (finalTrackRes.data.currentStatus !== "delivered") {
      throw new Error("Expected final status to be 'delivered'");
    }
    console.log(`✔ Order Successfully DELIVERED! Complete Stepper Progress: 6/6 Steps Complete ✅`);

    console.log("\n==================================================");
    console.log("🎉 ORDER LIFECYCLE & LIVE TRACKING VERIFIED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ TRACKING TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

testOrderTrackingFlow();
