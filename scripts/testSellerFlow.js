import mongoose from "mongoose";
import dotenv from "dotenv";
import express from "express";
import http from "http";

import app from "../app.js";
import Admin from "../Server/models/Admin.js";
import Seller from "../Server/models/Seller.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";
import SellerOffer from "../Server/models/SellerOffer.js";

dotenv.config();

const PORT = 5099;

async function runTests() {
  console.log("==================================================");
  console.log("🚀 STARTING SCHOOLKART SELLER SYSTEM INTEGRATION TEST");
  console.log("==================================================");

  let server;
  try {
    // Start temporary test server
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
    });

    const baseUrl = `http://localhost:${PORT}/api`;

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log("✔ Health Check:", healthData.status === "OK" ? "PASSED" : "FAILED");

    // Clean test seller if exists
    await Seller.deleteOne({ email: "test_seller@schoolkart.com" });
    await Product.deleteMany({ name: "Delhi Public School Uniform Shirt (Pack of 2)" });

    // 2. Register Seller (Simulating KYC documents & Google Maps Coordinates)
    console.log("\n--- TEST 1: Seller Registration with Geo Coordinates ---");
    const registerPayload = {
      name: "Ramesh Sharma",
      storeName: "Sharma School Uniforms & Books",
      email: "test_seller@schoolkart.com",
      phone: "9876500001",
      password: "sellerPassword123",
      address: "Shop 12, Hazratganj Main Market",
      city: "Lucknow",
      state: "Uttar Pradesh",
      pincode: "226001",
      latitude: 26.8467,
      longitude: 80.9462,
      formattedAddress: "Shop 12, Hazratganj, Lucknow, UP 226001",
      gstNumber: "09AAACH7409R1ZZ",
      accountHolderName: "Ramesh Sharma",
      accountNumber: "919876543210",
      ifscCode: "SBIN0001234",
      bankName: "State Bank of India",
      branchName: "Hazratganj",
      aadhaarNumber: "1234-5678-9012",
      panNumber: "ABCDE1234F"
    };

    const regRes = await fetch(`${baseUrl}/seller/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerPayload)
    });
    const regData = await regRes.json();
    console.log("Registration Response Status:", regRes.status);
    console.log("Registration Message:", regData.message);
    const sellerId = regData.sellerId;

    if (regRes.status === 201 && regData.status === "pending" && regData.location?.latitude === 26.8467) {
      console.log("✔ TEST 1 PASSED: Seller registered with PENDING status & Lat/Lng saved");
    } else {
      throw new Error("Seller registration failed: " + JSON.stringify(regData));
    }

    // 3. Attempt Seller Login (Should FAIL with 403 because pending)
    console.log("\n--- TEST 2: Seller Login Before Approval (Must be Blocked) ---");
    const loginAttempt1 = await fetch(`${baseUrl}/seller/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test_seller@schoolkart.com",
        password: "sellerPassword123"
      })
    });
    const loginData1 = await loginAttempt1.json();
    console.log("Login Attempt Status:", loginAttempt1.status);
    console.log("Login Message:", loginData1.message);

    if (loginAttempt1.status === 403 && loginData1.status === "pending") {
      console.log("✔ TEST 2 PASSED: Pending seller login correctly blocked");
    } else {
      throw new Error("Pending seller was able to log in or unexpected status: " + loginAttempt1.status);
    }

    // 4. Admin Login & Review Pending Sellers
    console.log("\n--- TEST 3: Admin Login & Seller Approval ---");
    const adminLoginRes = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@admin.com",
        password: "admin123"
      })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    console.log("Admin Logged In. Token received:", !!adminToken);

    // Get Pending Sellers
    const sellersListRes = await fetch(`${baseUrl}/admin/sellers?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const sellersListData = await sellersListRes.json();
    console.log(`Found ${sellersListData.sellers?.length || 0} pending seller(s) in Admin Review`);

    // Admin Approves Seller
    const approveRes = await fetch(`${baseUrl}/admin/sellers/${sellerId}/approve`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const approveData = await approveRes.json();
    console.log("Admin Approval Result:", approveData.message);

    if (approveRes.status === 200 && approveData.seller?.status === "approved") {
      console.log("✔ TEST 3 PASSED: Admin successfully approved seller");
    } else {
      throw new Error("Admin approval failed: " + JSON.stringify(approveData));
    }

    // 5. Seller Login Again (Should now SUCCEED)
    console.log("\n--- TEST 4: Approved Seller Login ---");
    const loginAttempt2 = await fetch(`${baseUrl}/seller/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test_seller@schoolkart.com",
        password: "sellerPassword123"
      })
    });
    const loginData2 = await loginAttempt2.json();
    const sellerToken = loginData2.token;

    if (loginAttempt2.status === 200 && sellerToken) {
      console.log("✔ TEST 4 PASSED: Seller logged in successfully with JWT token");
    } else {
      throw new Error("Approved seller login failed: " + JSON.stringify(loginData2));
    }

    // 6. Test Nearby Sellers Search (Geo Proximity)
    console.log("\n--- TEST 5: Nearby Sellers Search by Customer Lat/Lng ---");
    // Search within 10km of Hazratganj coordinates (26.8500, 80.9500)
    const nearbyRes = await fetch(`${baseUrl}/seller/nearby?lat=26.8500&lng=80.9500&radiusInKm=10`);
    const nearbyData = await nearbyRes.json();
    console.log(`Found ${nearbyData.count} nearby approved seller(s) within 10 km:`, nearbyData.sellers?.[0]?.storeName);

    if (nearbyRes.status === 200 && nearbyData.count >= 1) {
      console.log("✔ TEST 5 PASSED: Geo proximity search correctly returned nearby seller");
    } else {
      throw new Error("Nearby sellers search failed: " + JSON.stringify(nearbyData));
    }

    // 7. Seller Adds a SchoolKart Product with Per-Product Offer
    console.log("\n--- TEST 6: Seller Product Management with Offer ---");
    const productPayload = {
      name: "Delhi Public School Uniform Shirt (Pack of 2)",
      category: "uniform",
      subCategory: "shirts",
      schoolName: "Delhi Public School",
      classGrade: "Class 5th - 8th",
      price: 800,
      stock: 50,
      unit: "pack",
      description: "High quality breathable cotton uniform shirts approved by DPS Lucknow.",
      hasOffer: true,
      offerDiscountType: "percentage",
      offerDiscountValue: 15 // 15% discount -> 800 - 120 = 680
    };

    const addProductRes = await fetch(`${baseUrl}/seller/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sellerToken}`
      },
      body: JSON.stringify(productPayload)
    });
    const addProductData = await addProductRes.json();
    const createdProduct = addProductData.product;
    console.log("Product Created:", createdProduct?.name);
    console.log("Original Price: ₹", createdProduct?.price);
    console.log("Calculated Offer Price: ₹", createdProduct?.offer?.offerPrice);

    if (addProductRes.status === 201 && createdProduct?.offer?.offerPrice === 680) {
      console.log("✔ TEST 6 PASSED: Product created with 15% discount (₹800 -> ₹680)");
    } else {
      throw new Error("Product creation or discount calculation failed: " + JSON.stringify(addProductData));
    }

    // 8. Seller Creates Store-wide Coupon / Offer
    console.log("\n--- TEST 7: Seller Store-wide Coupon Creation ---");
    const offerPayload = {
      title: "Back to School Mega Discount",
      code: "SCHOOL10",
      description: "Get 10% off on minimum purchase of ₹500",
      discountType: "percentage",
      discountValue: 10,
      minOrderAmount: 500,
      maxDiscount: 200,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const addOfferRes = await fetch(`${baseUrl}/seller/offers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sellerToken}`
      },
      body: JSON.stringify(offerPayload)
    });
    const addOfferData = await addOfferRes.json();
    console.log("Offer Created:", addOfferData.offer?.code);

    if (addOfferRes.status === 201 && addOfferData.offer?.code === "SCHOOL10") {
      console.log("✔ TEST 7 PASSED: Store coupon created successfully");
    } else {
      throw new Error("Offer creation failed: " + JSON.stringify(addOfferData));
    }

    // 9. Multi-Vendor Order Creation & Seller Order Processing
    console.log("\n--- TEST 8: Order Placement & Seller Order Tracking ---");
    const orderPayload = {
      customer: {
        name: "Amit Verma",
        email: "amit@example.com",
        phone: "9988776655"
      },
      items: [
        {
          productId: createdProduct._id,
          sellerId: sellerId,
          name: createdProduct.name,
          price: 800,
          offerDiscount: 120,
          finalPrice: 680,
          quantity: 2,
          total: 1360,
          status: "pending"
        }
      ],
      totalAmount: 1360,
      shippingAddress: {
        street: "B-42, Gomti Nagar",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226010"
      },
      paymentMethod: "COD"
    };

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
    const orderData = await orderRes.json();
    const placedOrder = orderData.order;
    console.log("Order Placed:", placedOrder?._id, "Total: ₹", placedOrder?.totalAmount);

    // Seller views their orders
    const sellerOrdersRes = await fetch(`${baseUrl}/seller/orders`, {
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    const sellerOrdersData = await sellerOrdersRes.json();
    console.log(`Seller received ${sellerOrdersData.length} order(s). Subtotal: ₹${sellerOrdersData[0]?.sellerSubtotal}`);

    // Seller updates order item status to 'packed'
    const itemId = placedOrder.items[0]._id;
    const updateItemRes = await fetch(
      `${baseUrl}/seller/orders/${placedOrder._id}/items/${itemId}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sellerToken}`
        },
        body: JSON.stringify({ status: "packed" })
      }
    );
    const updateItemData = await updateItemRes.json();
    console.log("Item status updated to:", updateItemData.item?.status);

    if (updateItemRes.status === 200 && updateItemData.item?.status === "packed") {
      console.log("✔ TEST 8 PASSED: Seller tracked order and updated item status to 'packed'");
    } else {
      throw new Error("Order tracking failed: " + JSON.stringify(updateItemData));
    }

    console.log("\n==================================================");
    console.log("🎉 ALL INTEGRATION TESTS PASSED (INCLUDING MAPS/GEO)! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ TEST RUN FAILED:", error);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  }
}

runTests();
