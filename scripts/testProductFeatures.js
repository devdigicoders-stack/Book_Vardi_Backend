import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "../app.js";
import Seller from "../Server/models/Seller.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

dotenv.config();

const PORT = 5097;

async function testProductFeatures() {
  console.log("==================================================");
  console.log("🚀 TESTING PRODUCT SIZES, AGES & DISCOUNT PERCENTAGE");
  console.log("==================================================");

  let server;
  try {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
    });

    const baseUrl = `http://localhost:${PORT}/api`;

    // 1. Get or create test seller
    let seller = await Seller.findOne({ email: "test_seller@schoolkart.com" });
    if (!seller) {
      seller = new Seller({
        name: "Test Seller",
        storeName: "SchoolKart Uniforms & Supplies",
        email: "test_seller@schoolkart.com",
        phone: "9876500001",
        password: "sellerPassword123",
        address: "Shop 10, Hazratganj",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226001",
        status: "approved"
      });
      await seller.save();
    }

    // Login Seller
    const loginRes = await fetch(`${baseUrl}/seller/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test_seller@schoolkart.com",
        password: "sellerPassword123"
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("✔ Seller Logged In:", !!token);

    // Clean old test products
    await Product.deleteMany({ name: { $regex: "Test Product", $options: "i" } });

    // 2. Test 1: Create Product with Sizes, Age Groups & Discount % (MRP + Discount %)
    console.log("\n--- TEST 1: Create Product with Sizes, Age Group & Discount % ---");
    const productPayload1 = {
      name: "Test Product - DPS Cotton Uniform Shirt",
      category: "Uniforms",
      subCategory: "Shirts",
      schoolName: "Delhi Public School",
      schoolCode: "DPS",
      classGrade: "Class 1-5",
      gender: "Boy",
      ageGroup: "6-8 Years",
      ages: ["6-7 Years", "7-8 Years"],
      sizes: ["24", "26", "28", "30", "32", "S", "M"],
      colors: ["White", "Sky Blue"],
      material: "100% Breathable Cotton",
      brand: "SchoolKart Signature",
      mrp: 1000,
      discountPercentage: 20, // 20% discount -> price: 800
      stock: 100,
      unit: "piece",
      description: "Premium cotton uniform shirt for DPS primary students.",
      tags: ["Best Seller", "School Approved"],
      hasOffer: true,
      offerDiscountType: "percentage",
      offerDiscountValue: 10 // Extra 10% promotional offer -> offerPrice: 720 (800 - 80)
    };

    const res1 = await fetch(`${baseUrl}/seller/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(productPayload1)
    });
    const data1 = await res1.json();
    const p1 = data1.product;
    console.log("Created Product 1:", p1?.name);
    console.log(`MRP: ₹${p1?.mrp} | Selling Price: ₹${p1?.price} | Discount: ${p1?.discountPercentage}%`);
    console.log(`Sizes: [${p1?.sizes?.join(", ")}] | Age Group: ${p1?.ageGroup} | Ages: [${p1?.ages?.join(", ")}]`);
    console.log(`Promotional Offer Discount: ${p1?.offer?.discountValue}% | Offer Price: ₹${p1?.offer?.offerPrice}`);

    if (
      res1.status === 201 &&
      p1?.sizes?.includes("30") &&
      p1?.ageGroup === "6-8 Years" &&
      p1?.discountPercentage === 20 &&
      p1?.price === 800 &&
      p1?.offer?.offerPrice === 720
    ) {
      console.log("✔ TEST 1 PASSED: Sizes, Age Group, and Percentage Discount created and computed properly!");
    } else {
      throw new Error("Test 1 Failed: " + JSON.stringify(data1));
    }

    // 3. Test 2: Create Product with MRP and Selling Price -> Auto-calculate Discount %
    console.log("\n--- TEST 2: Auto-calculate Discount % from MRP and Price ---");
    const productPayload2 = {
      name: "Test Product - Navy Blue School Trousers",
      category: "Uniforms",
      subCategory: "Trousers",
      schoolName: "Delhi Public School",
      schoolCode: "DPS",
      classGrade: "Class 6-10",
      gender: "Boy",
      ageGroup: "11-14 Years",
      ages: ["11-12 Years", "13-14 Years"],
      sizes: ["30", "32", "34", "36", "L", "XL"],
      mrp: 1200,
      price: 900, // 1200 - 900 = 300 discount -> 25% discount
      stock: 60,
      unit: "piece"
    };

    const res2 = await fetch(`${baseUrl}/seller/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(productPayload2)
    });
    const data2 = await res2.json();
    const p2 = data2.product;
    console.log("Created Product 2:", p2?.name);
    console.log(`MRP: ₹${p2?.mrp} | Price: ₹${p2?.price} | Computed Discount: ${p2?.discountPercentage}%`);

    if (res2.status === 201 && p2?.discountPercentage === 25) {
      console.log("✔ TEST 2 PASSED: Discount Percentage (25%) auto-calculated successfully from MRP & Price!");
    } else {
      throw new Error("Test 2 Failed: " + JSON.stringify(data2));
    }

    // 4. Test 3: Public Filtering by Size, Age, and Minimum Discount
    console.log("\n--- TEST 3: Public Filtering (Size, Age Group, Discount) ---");
    
    // Filter by Size = 30
    const filterSizeRes = await fetch(`${baseUrl}/products?size=30`);
    const filterSizeData = await filterSizeRes.json();
    console.log(`Found ${filterSizeData.count} product(s) with size '30'`);

    // Filter by Age Group = 6-8 Years
    const filterAgeRes = await fetch(`${baseUrl}/products?ageGroup=6-8%20Years`);
    const filterAgeData = await filterAgeRes.json();
    console.log(`Found ${filterAgeData.count} product(s) for Age Group '6-8 Years'`);

    // Filter by Minimum Discount = 20%
    const filterDiscRes = await fetch(`${baseUrl}/products?minDiscount=20`);
    const filterDiscData = await filterDiscRes.json();
    console.log(`Found ${filterDiscData.count} product(s) with minDiscount >= 20%`);

    if (
      filterSizeData.count >= 2 &&
      filterAgeData.count >= 1 &&
      filterDiscData.count >= 2
    ) {
      console.log("✔ TEST 3 PASSED: Public filtering by Size, Age Group, and Discount percentage verified!");
    } else {
      throw new Error(
        `Test 3 Failed: sizeCount=${filterSizeData.count}, ageCount=${filterAgeData.count}, discCount=${filterDiscData.count}`
      );
    }

    // 5. Test 4: Placing Order with Selected Size & Age
    console.log("\n--- TEST 4: Placing Order with Selected Size & Age ---");
    const orderPayload = {
      customer: {
        name: "Rahul Verma",
        email: "rahul@example.com",
        phone: "9988776655"
      },
      items: [
        {
          productId: p1._id,
          sellerId: seller._id,
          name: p1.name,
          size: "30",
          age: "7-8 Years",
          price: 800,
          discountPercentage: 20,
          offerDiscount: 80,
          finalPrice: 720,
          quantity: 2,
          total: 1440,
          status: "pending"
        }
      ],
      totalAmount: 1440,
      shippingAddress: {
        street: "Flat 402, Royal Palms",
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
    const placedItem = orderData.order?.items?.[0];
    console.log(`Order Placed: ID=${orderData.order?._id}, Total=₹${orderData.order?.totalAmount}`);
    console.log(`Ordered Item: ${placedItem?.name} | Selected Size: ${placedItem?.size} | Selected Age: ${placedItem?.age}`);

    if (
      orderRes.status === 201 &&
      placedItem?.size === "30" &&
      placedItem?.age === "7-8 Years" &&
      placedItem?.finalPrice === 720
    ) {
      console.log("✔ TEST 4 PASSED: Order saved with selected size & age successfully!");
    } else {
      throw new Error("Test 4 Failed: " + JSON.stringify(orderData));
    }

    console.log("\n==================================================");
    console.log("🎉 ALL PRODUCT SIZE, AGE & DISCOUNT TESTS PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  }
}

testProductFeatures();
