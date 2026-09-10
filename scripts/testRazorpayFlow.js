import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import crypto from "crypto";
import app from "../app.js";
import User from "../Server/models/User.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

const PORT = 5096;

async function testRazorpayPurchaseFlow() {
  console.log("==================================================");
  console.log("💳 TESTING COMPLETE RAZORPAY PURCHASE WORKFLOW");
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
    // 1. REGISTER CUSTOMER
    console.log("\n--- STEP 1: Customer Signup & Token ---");
    const testEmail = `razorpay_buyer_${Date.now()}@schoolkart.com`;
    const userRes = await request("/users/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Vikram Malhotra",
        email: testEmail,
        password: "password123",
        phone: "9876543210"
      })
    });
    if (!userRes.ok) throw new Error("Customer registration failed");
    const userToken = userRes.data.token;
    console.log("✔ Customer logged in with JWT");

    // 2. CREATE PRODUCT TO PURCHASE
    console.log("\n--- STEP 2: Fetch Product Catalog ---");
    const testProduct = await Product.create({
      name: "Complete Science Lab Kit (Grade 9-10)",
      category: "Kits",
      price: 1850,
      mrp: 2200,
      discountPercentage: 16,
      stock: 15,
      sizes: ["Standard Box"]
    });
    console.log(`✔ Product ready: ${testProduct.name} (₹${testProduct.price})`);

    // 3. CREATE ORDER
    console.log("\n--- STEP 3: Create Order (Initiate Checkout) ---");
    const orderRes = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        items: [
          {
            productId: testProduct._id.toString(),
            name: testProduct.name,
            price: 1850,
            finalPrice: 1850,
            quantity: 1,
            size: "Standard Box",
            total: 1850
          }
        ],
        totalAmount: 1850,
        paymentMethod: "Razorpay",
        shippingAddress: {
          street: "12A, Knowledge Park III",
          city: "Greater Noida",
          state: "Uttar Pradesh",
          pincode: "201310"
        }
      })
    });
    if (!orderRes.ok) throw new Error("Order creation failed");
    const placedOrder = orderRes.data.order;
    console.log(`✔ Order Created: ID=${placedOrder._id}, Status=${placedOrder.overallStatus}, Payment=${placedOrder.paymentStatus}`);

    // 4. CREATE RAZORPAY ORDER
    console.log("\n--- STEP 4: Generate Razorpay Gateway Order ---");
    const rzpOrderRes = await request("/payments/create-order", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        orderId: placedOrder._id,
        amount: 1850,
        currency: "INR"
      })
    });
    if (!rzpOrderRes.ok || !rzpOrderRes.data.razorpayOrderId) {
      throw new Error(`Razorpay Order failed: ${JSON.stringify(rzpOrderRes.data)}`);
    }
    const { razorpayOrderId, key, amount } = rzpOrderRes.data;
    console.log(`✔ Razorpay Order Generated: ${razorpayOrderId} | Amount (in paise): ${amount} | Key ID: ${key}`);

    // 5. SIMULATE FRONTEND PAYMENT & VERIFY SIGNATURE
    console.log("\n--- STEP 5: Verify Payment Signature (HMAC-SHA256) ---");
    const fakePaymentId = "pay_" + Date.now().toString(36);
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Generate valid cryptographic signature
    const signature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${fakePaymentId}`)
      .digest("hex");

    const verifyRes = await request("/payments/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        orderId: placedOrder._id,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: signature
      })
    });

    if (!verifyRes.ok) throw new Error(`Verify signature failed: ${JSON.stringify(verifyRes.data)}`);
    console.log("✔ Payment Verified & Captured successfully!");

    // 6. CHECK ORDER UPDATED STATE
    console.log("\n--- STEP 6: Confirm Order Payment Status ---");
    const updatedOrder = await Order.findById(placedOrder._id);
    console.log(`✔ Order Payment Status: ${updatedOrder.paymentStatus.toUpperCase()}`);
    console.log(`✔ Order Overall Status: ${updatedOrder.overallStatus.toUpperCase()}`);
    console.log(`✔ Linked Razorpay Payment ID: ${updatedOrder.razorpayPaymentId}`);

    if (updatedOrder.paymentStatus !== "paid") {
      throw new Error("Order paymentStatus was not updated to 'paid'");
    }

    console.log("\n==================================================");
    console.log("🎉 RAZORPAY PAYMENT GATEWAY VERIFICATION PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ PAYMENT TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

testRazorpayPurchaseFlow();
