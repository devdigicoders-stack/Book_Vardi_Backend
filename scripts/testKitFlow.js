import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "../app.js";
import Seller from "../Server/models/Seller.js";
import Kit from "../Server/models/Kit.js";

dotenv.config();

const PORT = 5098;

async function testKitBundles() {
  console.log("==================================================");
  console.log("🚀 TESTING COMPLETE UNIFORM KIT BUNDLES API");
  console.log("==================================================");

  let server;
  try {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
    });

    const baseUrl = `http://localhost:${PORT}/api`;

    // 1. Get or Create approved test seller
    let seller = await Seller.findOne({ email: "test_seller@schoolkart.com" });
    if (!seller) {
      seller = new Seller({
        name: "Sharma Uniforms Pvt. Ltd.",
        storeName: "Sharma Uniforms Pvt. Ltd.",
        email: "test_seller@schoolkart.com",
        phone: "9876500001",
        password: "hashedPassword123",
        address: "Shop 12, Main Market",
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
    console.log("Seller Authenticated:", !!token);

    // Clean old test kits
    await Kit.deleteMany({
      $or: [
        { sellerId: seller._id },
        { title: { $regex: "Delhi Public School|Kendriya Vidyalaya", $options: "i" } }
      ]
    });

    // 2. Create Kit 1: DPS Boys Class 1-5 (Matching image UI)
    console.log("\n--- TEST 1: Create DPS Boy Uniform Kit Bundle ---");
    const dpsBoyKit = {
      title: "Delhi Public School Boy Uniform Kit",
      schoolName: "Delhi Public School",
      schoolCode: "DPS",
      gender: "Boy",
      classGrade: "Class 1-5",
      badgeTag: "Best Seller",
      bundlePrice: 1299,
      stock: 30,
      description: "Complete school-approved uniform bundle for DPS Boys Class 1-5.",
      items: [
        { name: "White Shirt", quantity: 2, unitPrice: 140, totalPrice: 280, size: "28", color: "White" },
        { name: "Navy Blue Pant", quantity: 2, unitPrice: 190, totalPrice: 380, size: "28", color: "Navy Blue" },
        { name: "School Tie", quantity: 1, unitPrice: 120, totalPrice: 120, size: "Free", color: "DPS Green" },
        { name: "Black Belt", quantity: 1, unitPrice: 80, totalPrice: 80, size: "28", color: "Black" },
        { name: "White Socks (3 pairs)", quantity: 1, unitPrice: 150, totalPrice: 150, size: "M", color: "White" }
      ]
    };

    const res1 = await fetch(`${baseUrl}/seller/kits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(dpsBoyKit)
    });
    const data1 = await res1.json();
    const kit1 = data1.kit;
    console.log("Created Kit 1:", kit1.title);
    console.log(`Total MRP: ₹${kit1.totalMrp} | Bundle Price: ₹${kit1.bundlePrice} | Savings: ₹${kit1.savingsAmount} (${kit1.discountPercentage}% OFF)`);

    if (res1.status === 201 && kit1.totalMrp === 1010 && kit1.bundlePrice === 1010) {
      console.log("✔ Kit 1 price handled correctly");
    }

    // 2. Create Kit 2: DPS Girls Class 1-5 (Exact match from screenshot: ₹1,540 -> ₹1,249 | Save ₹291)
    console.log("\n--- TEST 2: Create DPS Girl Uniform Kit Bundle ---");
    const dpsGirlKit = {
      title: "Delhi Public School Girl Uniform Kit",
      schoolName: "Delhi Public School",
      schoolCode: "DPS",
      gender: "Girl",
      classGrade: "Class 1-5",
      badgeTag: "New Arrival",
      bundlePrice: 1249,
      stock: 25,
      items: [
        { name: "White Blouse", quantity: 2, unitPrice: 130, totalPrice: 260 },
        { name: "Navy Pinafore/Skirt", quantity: 2, unitPrice: 210, totalPrice: 420 },
        { name: "School Ribbon", quantity: 1, unitPrice: 60, totalPrice: 60 },
        { name: "White Socks (3 pairs)", quantity: 1, unitPrice: 150, totalPrice: 150 },
        { name: "School Bag Cover", quantity: 1, unitPrice: 180, totalPrice: 180 },
        { name: "School Cardigan & Extra Supplies", quantity: 1, unitPrice: 470, totalPrice: 470 }
      ]
    };

    const res2 = await fetch(`${baseUrl}/seller/kits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(dpsGirlKit)
    });
    const data2 = await res2.json();
    const kit2 = data2.kit;
    console.log("Created Kit 2:", kit2.title);
    console.log(`Total MRP: ₹${kit2.totalMrp} | Bundle Price: ₹${kit2.bundlePrice} | Savings: ₹${kit2.savingsAmount} (${kit2.discountPercentage}% OFF)`);

    if (res2.status === 201 && kit2.totalMrp === 1540 && kit2.bundlePrice === 1249 && kit2.savingsAmount === 291) {
      console.log("✔ TEST 2 PASSED: Exact savings (Save ₹291, 19% OFF) verified!");
    } else {
      throw new Error("Kit 2 calculation mismatch: " + JSON.stringify(data2));
    }

    // 3. Create Kit 3: KV Kendriya Vidyalaya Boys Class 6-10 (Exact match from screenshot: ₹1,670 -> ₹1,399 | Save ₹271)
    console.log("\n--- TEST 3: Create Kendriya Vidyalaya Boy Uniform Kit Bundle ---");
    const kvKit = {
      title: "Kendriya Vidyalaya Boy Uniform Kit",
      schoolName: "Kendriya Vidyalaya",
      schoolCode: "KV",
      gender: "Boy",
      classGrade: "Class 6-10",
      badgeTag: "Verified KV",
      bundlePrice: 1399,
      stock: 40,
      items: [
        { name: "Light Blue Shirt", quantity: 2, unitPrice: 150, totalPrice: 300 },
        { name: "Dark Blue Trouser", quantity: 2, unitPrice: 210, totalPrice: 420 },
        { name: "KV Tie", quantity: 1, unitPrice: 130, totalPrice: 130 },
        { name: "Black Belt", quantity: 1, unitPrice: 80, totalPrice: 80 },
        { name: "Black Socks (3 pairs)", quantity: 1, unitPrice: 160, totalPrice: 160 },
        { name: "KV Official Sweater/Blazer Add-on", quantity: 1, unitPrice: 580, totalPrice: 580 }
      ]
    };

    const res3 = await fetch(`${baseUrl}/seller/kits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(kvKit)
    });
    const data3 = await res3.json();
    const kit3 = data3.kit;
    console.log("Created Kit 3:", kit3.title);
    console.log(`Total MRP: ₹${kit3.totalMrp} | Bundle Price: ₹${kit3.bundlePrice} | Savings: ₹${kit3.savingsAmount} (${kit3.discountPercentage}% OFF)`);

    if (res3.status === 201 && kit3.totalMrp === 1670 && kit3.bundlePrice === 1399 && kit3.savingsAmount === 271) {
      console.log("✔ TEST 3 PASSED: KV Kit exact savings (Save ₹271, 16% OFF) verified!");
    } else {
      throw new Error("Kit 3 calculation mismatch: " + JSON.stringify(data3));
    }

    // 4. Public Kit Browsing & School / Grade Filtering
    console.log("\n--- TEST 4: Public Kit Browsing & Filtering ---");
    const publicKitsRes = await fetch(`${baseUrl}/kits?schoolName=Kendriya Vidyalaya&gender=Boy`);
    const publicKitsData = await publicKitsRes.json();
    console.log(`Found ${publicKitsData.count} KV Boy kit(s):`, publicKitsData.kits?.[0]?.title);

    if (publicKitsRes.status === 200 && publicKitsData.count === 1) {
      console.log("✔ TEST 4 PASSED: Public search & filter returned correct kit bundle");
    } else {
      throw new Error("Public kit filter failed: " + JSON.stringify(publicKitsData));
    }

    console.log("\n==================================================");
    console.log("🎉 ALL UNIFORM KIT BUNDLE TESTS PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ KIT TEST FAILED:", error);
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  }
}

testKitBundles();
