import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import Seller from "../Server/models/Seller.js";
import Product from "../Server/models/Product.js";
import Order from "../Server/models/Order.js";

const PORT = 5094;

async function testDeliveryWorkflow() {
  console.log("==================================================");
  console.log("🚚 TESTING SELLER DELIVERY CAPABILITIES & PROXIMITY");
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
    const unique = Date.now().toString(36);

    // 1. REGISTER SELLER WITH SELF DELIVERY RADIUS (e.g. 8 KM)
    console.log("\n--- STEP 1: Register Seller with Self-Delivery (Radius: 8km) ---");
    const sellerRegRes = await request("/seller/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Ramesh Uniform Stores",
        storeName: "Ramesh School Uniforms & Stationery",
        email: `ramesh_store_${unique}@schoolkart.com`,
        phone: `99887766${Math.floor(10 + Math.random() * 89)}`,
        password: "password123",
        address: "Shop 14, Main Market, Gomti Nagar",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226010",
        latitude: 26.8500, // Gomti Nagar, Lucknow
        longitude: 80.9900,
        selfDelivery: true,
        maxDeliveryRadiusKm: 8,
        thirdPartyDelivery: true
      })
    });

    if (!sellerRegRes.ok) {
      throw new Error(`Seller registration failed: ${JSON.stringify(sellerRegRes.data)}`);
    }
    const sellerId = sellerRegRes.data.sellerId;
    console.log(`✔ Seller Registered with Delivery Preferences: Self Delivery = ${sellerRegRes.data.deliveryPreferences.selfDelivery}, Max Radius = ${sellerRegRes.data.deliveryPreferences.maxDeliveryRadiusKm} km`);

    // Approve Seller for testing
    await Seller.findByIdAndUpdate(sellerId, { status: "approved" });

    // Login Seller
    const loginRes = await request("/seller/login", {
      method: "POST",
      body: JSON.stringify({
        email: `ramesh_store_${unique}@schoolkart.com`,
        password: "password123"
      })
    });
    if (!loginRes.ok) throw new Error("Seller login failed");
    const sellerToken = loginRes.data.token;
    console.log("✔ Approved Seller Logged in successfully");

    // 2. CREATE PRODUCT FOR THIS SELLER
    console.log("\n--- STEP 2: Create Seller Product ---");
    const product = await Product.create({
      sellerId,
      name: "St. Francis School Belt & Tie Combo",
      category: "Accessories",
      price: 350,
      mrp: 450,
      discountPercentage: 22,
      stock: 50,
      sizes: ["Standard"]
    });
    console.log(`✔ Product Created: ${product.name} (Seller ID: ${sellerId})`);

    // 3. CASE A: NEARBY CUSTOMER PLACES ORDER (Within 8km -> Self Delivery tagged)
    console.log("\n--- STEP 3: Nearby Customer Places Order (Distance ~3 km) ---");
    const nearbyOrderRes = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: { name: "Ananya Dixit", phone: "9876541230" },
        items: [
          {
            productId: product._id.toString(),
            name: product.name,
            price: 350,
            finalPrice: 350,
            quantity: 2,
            total: 700
          }
        ],
        totalAmount: 700,
        paymentMethod: "COD",
        customerLat: 26.8600, // ~2.5 km away from seller
        customerLng: 80.9950,
        shippingAddress: {
          street: "Sector 4, Gomti Nagar Extension",
          city: "Lucknow",
          state: "Uttar Pradesh",
          pincode: "226010"
        }
      })
    });
    if (!nearbyOrderRes.ok) throw new Error("Nearby order creation failed");
    const nearbyOrder = nearbyOrderRes.data.order;
    const nearbyItem = nearbyOrder.items[0];
    console.log(`✔ Nearby Order Created: ID=${nearbyOrder._id}`);
    console.log(`✔ Distance from Seller: ${nearbyItem.distanceFromSellerKm} km (Limit: ${nearbyItem.deliveryRadiusKm} km)`);
    console.log(`✔ Auto-Assigned Delivery Option: ${nearbyItem.deliveryType.toUpperCase()} ✅`);

    if (nearbyItem.deliveryType !== "self_delivery") {
      throw new Error("Expected self_delivery for nearby customer");
    }

    // 4. CASE B: FAR CUSTOMER PLACES ORDER (>8km -> Third Party Courier tagged)
    console.log("\n--- STEP 4: Far Customer Places Order (Distance ~18 km) ---");
    const farOrderRes = await request("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: { name: "Sunil Kapoor", phone: "9876500000" },
        items: [
          {
            productId: product._id.toString(),
            name: product.name,
            price: 350,
            finalPrice: 350,
            quantity: 1,
            total: 350
          }
        ],
        totalAmount: 350,
        paymentMethod: "COD",
        customerLat: 26.7500, // ~15-20 km away
        customerLng: 80.8900,
        shippingAddress: {
          street: "Sarojini Nagar Industrial Area",
          city: "Lucknow",
          state: "Uttar Pradesh",
          pincode: "226008"
        }
      })
    });
    if (!farOrderRes.ok) throw new Error("Far order creation failed");
    const farOrder = farOrderRes.data.order;
    const farItem = farOrder.items[0];
    console.log(`✔ Far Order Created: ID=${farOrder._id}`);
    console.log(`✔ Distance from Seller: ${farItem.distanceFromSellerKm} km (Limit: ${farItem.deliveryRadiusKm} km)`);
    console.log(`✔ Auto-Assigned Delivery Option: ${farItem.deliveryType.toUpperCase()} (Courier Needed) ✅`);

    if (farItem.deliveryType !== "third_party") {
      throw new Error("Expected third_party delivery for far customer");
    }

    // 5. SELLER FULFILLMENT: Fulfill with Self-Delivery Boy
    console.log("\n--- STEP 5: Seller Fulfills Nearby Order via Self Delivery ---");
    const fulfillSelfRes = await request(`/seller/orders/${nearbyOrder._id}/items/${nearbyItem._id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        status: "shipped",
        deliveryType: "self_delivery",
        selfDeliveryDetails: {
          deliveryPersonName: "Mohan Lal",
          deliveryPersonPhone: "9876501234",
          vehicleNumber: "UP 32 AB 1234"
        }
      })
    });
    if (!fulfillSelfRes.ok) throw new Error("Self delivery fulfillment failed");
    console.log(`✔ Order Item updated to 'shipped' via Self Delivery (Rider: Mohan Lal, Phone: 9876501234, OTP: ${fulfillSelfRes.data.item.selfDeliveryDetails.deliveryOtp})`);

    // 6. SELLER FULFILLMENT: Fulfill with Third-Party Courier (Delhivery / BlueDart)
    console.log("\n--- STEP 6: Seller Fulfills Far Order via Third-Party Courier ---");
    const fulfillThirdPartyRes = await request(`/seller/orders/${farOrder._id}/items/${farItem._id}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        status: "shipped",
        deliveryType: "third_party",
        thirdPartyDetails: {
          courierName: "Delhivery Surface",
          trackingNumber: "DLV891238912IN",
          trackingUrl: "https://www.delhivery.com/track/package/DLV891238912IN"
        }
      })
    });
    if (!fulfillThirdPartyRes.ok) throw new Error("Third party courier fulfillment failed");
    console.log(`✔ Order Item updated to 'shipped' via Courier (${fulfillThirdPartyRes.data.item.thirdPartyDetails.courierName}, AWB: ${fulfillThirdPartyRes.data.item.thirdPartyDetails.trackingNumber})`);

    console.log("\n==================================================");
    console.log("🎉 SELLER DELIVERY PREFERENCES & DISPATCH TEST PASSED! 🎉");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ DELIVERY TEST ERROR:", error);
    process.exit(1);
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

testDeliveryWorkflow();
