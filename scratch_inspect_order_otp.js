import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
  const o = await Order.findOne({ orderId: "JDR177776" }).lean();
  console.log("=== FULL ORDER JDR177776 ===");
  console.log("overallStatus:", o.overallStatus);
  console.log("status:", o.status);
  console.log("deliveryMode:", o.deliveryMode);
  console.log("deliveryOtp:", JSON.stringify(o.deliveryOtp));
  console.log("selfDeliveryDetails:", o.selfDeliveryDetails);
  console.log("item 0 selfDeliveryDetails:", o.items?.[0]?.selfDeliveryDetails);
  console.log("item 0 deliveryOtp:", JSON.stringify(o.items?.[0]?.deliveryOtp));
  console.log("timeline (last 3):", o.timeline?.slice(-3));
  await mongoose.disconnect();
}

check().catch(console.error);
