import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Order = mongoose.model("Order", new mongoose.Schema({}, { strict: false }));
  const o = await Order.findOne({ orderId: "XDU466143" }).lean();
  const it = o.items[0];
  console.log("name:", it.name);
  console.log("price:", it.price);
  console.log("unitPrice:", it.unitPrice);
  console.log("finalPrice:", it.finalPrice);
  console.log("mrp:", it.mrp);
  console.log("sellerPrice:", it.sellerPrice);
  console.log("quantity:", it.quantity);
  console.log("total:", it.total);
  console.log("item total / qty:", it.total / it.quantity);
  console.log("gstPercent:", it.gstPercent);
  await mongoose.disconnect();
}

check().catch(console.error);
