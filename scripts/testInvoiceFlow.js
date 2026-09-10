import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import User from "../Server/models/User.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

const PORT = 5095;

async function testInvoiceGeneration() {
  console.log("==================================================");
  console.log("📄 TESTING FLIPKART-STYLE TAX INVOICE PDF GENERATION");
  console.log("==================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once("open", resolve));
  }

  const BASE_URL = `http://localhost:${PORT}/api`;

  try {
    // 1. Create a Sample Product & Order
    const testProduct = await Product.create({
      name: "Delhi Public School Winter Blazer (Navy Blue)",
      category: "Uniforms",
      price: 1650,
      mrp: 2100,
      discountPercentage: 21,
      stock: 20,
      sizes: ["32"]
    });

    const testOrder = await Order.create({
      customer: {
        name: "Pooja Verma",
        email: "pooja.verma@example.com",
        phone: "9123456780"
      },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          price: 1650,
          finalPrice: 1650,
          quantity: 1,
          size: "32",
          age: "9-10 Years",
          total: 1650
        }
      ],
      totalAmount: 1650,
      paymentMethod: "Razorpay",
      paymentStatus: "paid",
      overallStatus: "processing",
      razorpayPaymentId: "pay_test_inv_12345",
      shippingAddress: {
        street: "B-204, Royal Palms Residency",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226028"
      }
    });

    console.log(`✔ Sample Order Created: ID=${testOrder._id}`);

    // 2. Fetch Invoice from API Endpoint
    const invoiceRes = await fetch(`${BASE_URL}/orders/${testOrder._id}/invoice`);

    if (!invoiceRes.ok) {
      throw new Error(`Invoice fetch failed with status ${invoiceRes.status}`);
    }

    const contentType = invoiceRes.headers.get("content-type");
    const contentDisposition = invoiceRes.headers.get("content-disposition");
    const pdfBuffer = await invoiceRes.arrayBuffer();

    console.log(`✔ Invoice Response Status: ${invoiceRes.status}`);
    console.log(`✔ Content-Type: ${contentType}`);
    console.log(`✔ Content-Disposition: ${contentDisposition}`);
    console.log(`✔ PDF File Size: ${pdfBuffer.byteLength} bytes`);

    if (!contentType.includes("application/pdf")) {
      throw new Error("Content-Type is not application/pdf");
    }

    if (pdfBuffer.byteLength < 1000) {
      throw new Error("Generated PDF file is too small / corrupt");
    }

    console.log("\n==================================================");
    console.log("🎉 TAX INVOICE PDF GENERATION VERIFIED SUCCESSFULLY! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ INVOICE TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

testInvoiceGeneration();
