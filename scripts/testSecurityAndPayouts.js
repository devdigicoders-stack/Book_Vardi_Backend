import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import http from "http";
import app from "../app.js";
import User from "../Server/models/User.js";
import Seller from "../Server/models/Seller.js";
import Payout from "../Server/models/Payout.js";

const PORT = 5092;

async function testSecurityAndPayouts() {
  console.log("==================================================");
  console.log("🔒 TESTING SECURITY, PASSWORD RESET & PAYOUT LEDGER");
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
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  };

  try {
    // 1. TEST HELMET SECURITY HEADERS
    console.log("\n--- TEST 1: Helmet Security Headers ---");
    const healthRes = await request("/health");
    console.log("✔ Health Status:", healthRes.data.status);
    console.log("✔ X-DNS-Prefetch-Control Header:", healthRes.headers.get("x-dns-prefetch-control"));
    console.log("✔ X-Frame-Options Header:", healthRes.headers.get("x-frame-options"));

    // 2. TEST FORGOT & RESET PASSWORD FLOW
    console.log("\n--- TEST 2: Customer Forgot & Reset Password ---");
    const userEmail = `security_user_${Date.now()}@schoolkart.com`;
    const regRes = await request("/users/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Security Tester",
        email: userEmail,
        password: "oldPassword123"
      })
    });
    if (!regRes.ok) throw new Error("User registration failed");
    console.log("✔ User registered with initial password");

    // Request Reset Token
    const forgotRes = await request("/users/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: userEmail })
    });
    if (!forgotRes.ok) throw new Error("Forgot password failed");
    const userInDb = await User.findOne({ email: userEmail });
    const resetToken = userInDb.resetPasswordToken;
    console.log(`✔ Password Reset Token Generated: ${resetToken}`);

    // Reset Password with Token
    const resetRes = await request("/users/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: userEmail,
        resetToken,
        newPassword: "newSecurePassword456"
      })
    });
    if (!resetRes.ok) throw new Error("Reset password failed");
    console.log("✔ Password reset successfully!");

    // Verify Login with New Password
    const loginRes = await request("/users/login", {
      method: "POST",
      body: JSON.stringify({
        email: userEmail,
        password: "newSecurePassword456"
      })
    });
    if (!loginRes.ok) throw new Error("Login with new password failed");
    console.log("✔ Login verified with newly updated password!");

    // 3. TEST SELLER WALLET, COMMISSION & PAYOUT FLOW
    console.log("\n--- TEST 3: Seller Commission, Wallet & Payout Request ---");
    const bcrypt = (await import("bcryptjs")).default;
    const hashedPassword = await bcrypt.hash("password123", 10);

    const seller = await Seller.create({
      name: "Gupta Books & Uniforms",
      storeName: "Gupta Educational Hub",
      email: `seller_wallet_${Date.now()}@schoolkart.com`,
      phone: `9911${Math.floor(100000 + Math.random() * 899999)}`,
      password: hashedPassword,
      address: "Shop 10, Civil Lines",
      city: "Lucknow",
      state: "UP",
      pincode: "226001",
      status: "approved",
      walletBalance: 5000, // Initial wallet balance: ₹5000
      totalEarnings: 5000,
      commissionPercentage: 5,
      bankDetails: {
        accountHolderName: "Gupta Educational Hub",
        accountNumber: "987654321012",
        ifscCode: "HDFC0001234",
        bankName: "HDFC Bank"
      }
    });

    // Login Seller
    const sellerLoginRes = await request("/seller/login", {
      method: "POST",
      body: JSON.stringify({
        email: seller.email,
        password: "password123"
      })
    });
    const sellerToken = sellerLoginRes.data.token;

    // Check Wallet Overview
    const walletRes = await request("/seller/wallet", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` }
    });
    if (!walletRes.ok) throw new Error("Wallet overview failed");
    console.log(`✔ Seller Wallet Balance: ₹${walletRes.data.wallet.walletBalance} | Platform Fee: ${walletRes.data.wallet.commissionPercentage}%`);

    // Request Payout of ₹2000
    const payoutReqRes = await request("/seller/payout-request", {
      method: "POST",
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: JSON.stringify({
        amount: 2000,
        notes: "Monthly earnings settlement"
      })
    });
    if (!payoutReqRes.ok) throw new Error(`Payout request failed: ${JSON.stringify(payoutReqRes.data)}`);
    const payout = payoutReqRes.data.payout;
    console.log(`✔ Payout Requested: ID=${payout.payoutId}, Amount=₹${payout.amount}, Remaining Wallet=₹${payoutReqRes.data.remainingWalletBalance}`);

    // 4. ADMIN APPROVES & PROCESSES PAYOUT
    console.log("\n--- TEST 4: Admin Processes Payout ---");
    const adminLoginRes = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@admin.com",
        password: "admin123"
      })
    });
    const adminToken = adminLoginRes.data.token;

    const processRes = await request(`/admin/payouts/${payout._id}/process`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        action: "approve",
        transactionReference: "IMPS_UTR_987123654"
      })
    });
    if (!processRes.ok) throw new Error("Admin process payout failed");
    console.log(`✔ Admin Processed Payout: Status=${processRes.data.payout.status.toUpperCase()}, UTR=${processRes.data.payout.transactionReference}`);

    const updatedSeller = await Seller.findById(seller._id);
    console.log(`✔ Seller Updated Wallet: Available=₹${updatedSeller.walletBalance}, Total Withdrawn=₹${updatedSeller.totalWithdrawn}`);

    console.log("\n==================================================");
    console.log("🎉 ALL SECURITY, PASSWORD RESET & PAYOUT TESTS PASSED! 🎉");
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

testSecurityAndPayouts();
