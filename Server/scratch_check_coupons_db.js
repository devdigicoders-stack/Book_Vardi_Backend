import mongoose from "mongoose";

async function run() {
  const conn = await mongoose.createConnection("mongodb://127.0.0.1:27017/bookvardi_db_final").asPromise();
  const collections = await conn.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  if (collections.some(c => c.name === "coupons")) {
    const coupons = await conn.db.collection("coupons").find({}).toArray();
    console.log("=== DB COUPONS ===", coupons.length);
    coupons.forEach(c => console.log("Coupon:", c));
  }

  if (collections.some(c => c.name === "promotions")) {
    const promotions = await conn.db.collection("promotions").find({}).toArray();
    console.log("=== DB PROMOTIONS ===", promotions.length);
    promotions.forEach(p => console.log("Promotion:", p));
  }

  if (collections.some(c => c.name === "selleroffers")) {
    const offers = await conn.db.collection("selleroffers").find({}).toArray();
    console.log("=== DB SELLER OFFERS ===", offers.length);
    offers.forEach(o => console.log("SellerOffer:", o));
  }

  await conn.close();
}

run().catch(console.error);
