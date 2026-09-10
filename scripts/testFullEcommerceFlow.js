import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import User from "../Server/models/User.js";
import Product from "../Server/models/Product.js";
import Coupon from "../Server/models/Coupon.js";
import Order from "../Server/models/Order.js";
import Cart from "../Server/models/Cart.js";
import Wishlist from "../Server/models/Wishlist.js";
import Review from "../Server/models/Review.js";

const PORT = 5098;

async function runFullEcommerceTests() {
  console.log("==================================================");
  console.log("🚀 TESTING COMPLETE E-COMMERCE BACKEND WORKFLOW");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  // Wait for db connection
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
    const testEmail = `testuser_${Date.now()}@schoolkart.com`;

    // 1. TEST USER REGISTRATION & LOGIN
    console.log("\n--- TEST 1: User Registration & Login ---");
    const regRes = await request("/users/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Rahul Sharma",
        email: testEmail,
        password: "password123",
        phone: "9876543210"
      })
    });

    if (!regRes.ok || !regRes.data.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    }
    const userToken = regRes.data.token;
    const userId = regRes.data.user.id;
    console.log(`✔ User Registered successfully (ID: ${userId})`);

    const loginRes = await request("/users/login", {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        password: "password123"
      })
    });
    if (!loginRes.ok) throw new Error("Login failed");
    console.log("✔ User Login verified with JWT token");

    // 2. TEST USER ADDRESS MANAGEMENT
    console.log("\n--- TEST 2: Add Saved Address ---");
    const addrRes = await request("/users/addresses", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        street: "Flat 402, Green Valley Apartments",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226010",
        landmark: "Near City Park",
        addressType: "Home"
      })
    });
    if (!addrRes.ok) throw new Error("Add address failed");
    console.log(`✔ Address saved. Total addresses: ${addrRes.data.addresses.length}`);

    // 3. CREATE A TEST PRODUCT WITH STOCK
    console.log("\n--- TEST 3: Create Test Product ---");
    const testProduct = await Product.create({
      name: "Oxford School Bag 35L Water Resistant",
      category: "Bags",
      price: 1200,
      mrp: 1500,
      discountPercentage: 20,
      stock: 10,
      status: "available",
      sizes: ["Standard"]
    });
    console.log(`✔ Test Product created: ${testProduct.name} | Initial Stock: ${testProduct.stock}`);

    // 4. TEST CART MANAGEMENT
    console.log("\n--- TEST 4: Add to Cart & Update Quantity ---");
    const addCartRes = await request("/cart/add", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        productId: testProduct._id.toString(),
        quantity: 2,
        size: "Standard"
      })
    });
    if (!addCartRes.ok) throw new Error(`Add to cart failed: ${JSON.stringify(addCartRes.data)}`);
    console.log(`✔ Added to Cart. Items: ${addCartRes.data.cart.items.length}, Total: ₹${addCartRes.data.cart.totalAmount}`);

    const getCartRes = await request("/cart", {
      method: "GET",
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (!getCartRes.ok || getCartRes.data.items.length === 0) throw new Error("Get cart failed");
    console.log("✔ Cart retrieved successfully with product details");

    // 5. TEST WISHLIST
    console.log("\n--- TEST 5: Wishlist Add & Fetch ---");
    const wishRes = await request("/wishlist/toggle", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ productId: testProduct._id.toString() })
    });
    if (!wishRes.ok) throw new Error("Wishlist toggle failed");
    console.log(`✔ Wishlist toggled: ${wishRes.data.action}`);

    // 6. TEST COUPON VALIDATION & CALCULATION
    console.log("\n--- TEST 6: Coupon Validation & Calculation ---");
    const couponCode = `SKDISC_${Date.now()}`;
    await Coupon.create({
      code: couponCode,
      discount: 15,
      type: "percentage",
      minAmount: 1000,
      status: "active",
      expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    });

    const couponRes = await request("/coupons/apply", {
      method: "POST",
      body: JSON.stringify({
        code: couponCode,
        cartTotal: 2400
      })
    });
    if (!couponRes.ok || couponRes.data.discountAmount !== 360) {
      throw new Error(`Coupon apply failed: ${JSON.stringify(couponRes.data)}`);
    }
    console.log(`✔ Coupon ${couponCode} applied: 15% off on ₹2400 -> Discount: ₹${couponRes.data.discountAmount}, Payable: ₹${couponRes.data.finalPayable}`);

    // 7. TEST ORDER PLACEMENT & STOCK AUTO-DEDUCTION
    console.log("\n--- TEST 7: Order Placement & Inventory Auto-Deduction ---");
    const orderRes = await request("/orders", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        items: [
          {
            productId: testProduct._id.toString(),
            name: testProduct.name,
            price: 1200,
            finalPrice: 1020,
            quantity: 3,
            size: "Standard",
            total: 3060
          }
        ],
        totalAmount: 3060,
        paymentMethod: "COD",
        shippingAddress: {
          street: "Flat 402, Green Valley Apartments",
          city: "Lucknow",
          state: "Uttar Pradesh",
          pincode: "226010"
        }
      })
    });
    if (!orderRes.ok) throw new Error(`Place order failed: ${JSON.stringify(orderRes.data)}`);
    const placedOrder = orderRes.data.order;
    console.log(`✔ Order placed successfully. Order ID: ${placedOrder._id}`);

    // Check stock reduction
    const updatedProd = await Product.findById(testProduct._id);
    console.log(`✔ Stock before: 10, Quantity ordered: 3, Stock after: ${updatedProd.stock}`);
    if (updatedProd.stock !== 7) throw new Error("Stock auto-deduction failed");

    // 8. TEST MY ORDERS ENDPOINT
    console.log("\n--- TEST 8: Get Customer Order History ---");
    const myOrdersRes = await request("/orders/my-orders", {
      method: "GET",
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (!myOrdersRes.ok || myOrdersRes.data.length === 0) throw new Error("My orders failed");
    console.log(`✔ Retrieved ${myOrdersRes.data.length} customer order(s)`);

    // 9. TEST PRODUCT REVIEWS & RATING RECALCULATION
    console.log("\n--- TEST 9: Product Review & Rating Update ---");
    const reviewRes = await request("/reviews", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        productId: testProduct._id.toString(),
        rating: 5,
        comment: "Excellent quality school bag! Highly recommended."
      })
    });
    if (!reviewRes.ok) throw new Error(`Add review failed: ${JSON.stringify(reviewRes.data)}`);
    console.log(`✔ Review submitted. Verified Purchase: ${reviewRes.data.review.verifiedPurchase}`);
    console.log(`✔ Product New Average Rating: ${reviewRes.data.productRating.averageRating} (${reviewRes.data.productRating.numReviews} review)`);

    // 10. TEST ORDER CANCELLATION & RESTOCK
    console.log("\n--- TEST 10: Order Cancellation & Inventory Restock ---");
    const cancelRes = await request(`/orders/${placedOrder._id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        overallStatus: "cancelled"
      })
    });
    if (!cancelRes.ok) throw new Error("Order cancel failed");
    const restockedProd = await Product.findById(testProduct._id);
    console.log(`✔ Order Cancelled. Restocked Product Stock: ${restockedProd.stock} (Restored back to 10)`);
    if (restockedProd.stock !== 10) throw new Error("Restocking failed");

    console.log("\n==================================================");
    console.log("🎉 ALL E-COMMERCE BACKEND MODULE TESTS PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runFullEcommerceTests();
