import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import Admin from "../Server/models/Admin.js";
import Seller from "../Server/models/Seller.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

const PORT = 5091;

async function testExportFunctionality() {
  console.log("==================================================");
  console.log("📊 TESTING EXCEL/CSV DATA EXPORT ENGINE");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once("open", resolve));
  }

  const BASE_URL = `http://localhost:${PORT}/api`;

  try {
    // 1. ADMIN LOGIN
    console.log("\n--- STEP 1: Admin Login ---");
    const adminRes = await fetch(`${BASE_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@admin.com", password: "admin123" })
    });
    const adminData = await adminRes.json();
    const adminToken = adminData.token;
    console.log("✔ Admin Logged In with Token");

    // 2. TEST ADMIN EXPORT ORDERS (CSV/Excel)
    console.log("\n--- STEP 2: Export All Orders CSV ---");
    const exportOrdersRes = await fetch(`${BASE_URL}/admin/export/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const ordersCsv = await exportOrdersRes.text();
    console.log("✔ Content-Type:", exportOrdersRes.headers.get("content-type"));
    console.log("✔ Content-Disposition:", exportOrdersRes.headers.get("content-disposition"));
    console.log("✔ CSV Length:", ordersCsv.length, "characters");
    console.log("✔ Header Columns Sample:", ordersCsv.split("\n")[0]);

    if (!ordersCsv.includes("Order ID") || !ordersCsv.includes("Customer Name")) {
      throw new Error("Invalid orders CSV format");
    }

    // 3. TEST ADMIN EXPORT PRODUCTS CATALOG
    console.log("\n--- STEP 3: Export Products Catalog CSV ---");
    const exportProdRes = await fetch(`${BASE_URL}/admin/export/products`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const prodCsv = await exportProdRes.text();
    console.log("✔ Products CSV Header:", prodCsv.split("\n")[0]);
    if (!prodCsv.includes("Product Name") || !prodCsv.includes("Selling Price (INR)")) {
      throw new Error("Invalid products CSV format");
    }

    // 4. TEST ADMIN EXPORT SELLERS & PAYOUTS REPORT
    console.log("\n--- STEP 4: Export Sellers Report CSV ---");
    const exportSellersRes = await fetch(`${BASE_URL}/admin/export/sellers`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const sellersCsv = await exportSellersRes.text();
    console.log("✔ Sellers CSV Header:", sellersCsv.split("\n")[0]);
    if (!sellersCsv.includes("Store Name") || !sellersCsv.includes("Wallet Balance (INR)")) {
      throw new Error("Invalid sellers CSV format");
    }

    console.log("\n==================================================");
    console.log("🎉 ALL EXCEL / CSV EXPORT TESTS PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ EXPORT TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

testExportFunctionality();
