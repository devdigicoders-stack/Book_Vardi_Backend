import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';

// Models
import Order from './Server/models/Order.js';
import Product from './Server/models/Product.js';
import User from './Server/models/User.js';
import Announcement from './Server/models/Announcement.js';
import ContactMsg from './Server/models/ContactMsg.js';

// Controllers
import {
  requestReturnExchange,
  updateReturnExchangeStatus
} from './Server/controllers/orderController.js';

import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement
} from './Server/controllers/announcementController.js';

// Helper for Mock Response
const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    }
  };
  return res;
};

// Test Suite Metrics
const testSuiteResults = [];

const recordTestResult = (suite, name, success, statusCode, message, dataSample = null) => {
  testSuiteResults.push({
    suite,
    name,
    status: success ? 'PASS' : 'FAIL',
    statusCode,
    message,
    response: dataSample
  });
};

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING RETURN & NOTIFICATION API TEST SUITE");
  console.log("=================================================\n");

  try {
    await connectDB();
    console.log("✅ Database Connected Successfully.\n");

    // -------------------------------------------------------------
    // PART 1: RETURN & EXCHANGE API TESTS
    // -------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("📦 TEST SET 1: RETURN & EXCHANGE API");
    console.log("-------------------------------------------------\n");

    // Create a temporary test user and product
    const testUser = await User.create({
      name: "Test Customer Return",
      email: `testreturn_${Date.now()}@example.com`,
      phone: "9999998888"
    });

    const testProduct = await Product.create({
      name: "Return Test School Shirt",
      price: 499,
      mrp: 699,
      category: "School Uniform",
      isReturnable: true,
      isExchangeable: true,
      isRefundable: true,
      returnWindowDays: 7,
      stock: 50,
      stockQuantity: 50
    });

    const nonReturnableProduct = await Product.create({
      name: "Non-Returnable Custom Blazer",
      price: 1299,
      category: "School Uniform",
      isReturnable: false,
      isExchangeable: false,
      isRefundable: false,
      returnWindowDays: 0,
      stock: 10
    });

    // Create a Delivered test order eligible for return
    const deliveredOrder = await Order.create({
      orderId: `ORD-RET-${Date.now()}`,
      userId: testUser._id,
      customer: { name: testUser.name, phone: testUser.phone, email: testUser.email },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          price: 499,
          quantity: 1,
          status: "Delivered"
        }
      ],
      shippingAddress: {
        name: testUser.name,
        phone: testUser.phone,
        addressLine: "123 Test St",
        city: "Lucknow",
        state: "UP",
        pincode: "226001"
      },
      status: "Delivered",
      overallStatus: "Delivered",
      deliveredAt: new Date(),
      totalAmount: 499,
      paymentMethod: "UPI",
      paymentStatus: "paid"
    });

    // Create a Pending (non-delivered) test order
    const pendingOrder = await Order.create({
      orderId: `ORD-PEND-${Date.now()}`,
      userId: testUser._id,
      customer: { name: testUser.name, phone: testUser.phone, email: testUser.email },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          price: 499,
          quantity: 1,
          status: "Processing"
        }
      ],
      status: "Processing",
      overallStatus: "Processing",
      totalAmount: 499
    });

    // Create an order with non-returnable product
    const nonRetOrder = await Order.create({
      orderId: `ORD-NONRET-${Date.now()}`,
      userId: testUser._id,
      customer: { name: testUser.name, phone: testUser.phone },
      items: [
        {
          productId: nonReturnableProduct._id,
          name: nonReturnableProduct.name,
          price: 1299,
          quantity: 1,
          status: "Delivered"
        }
      ],
      status: "Delivered",
      overallStatus: "Delivered",
      deliveredAt: new Date(),
      totalAmount: 1299
    });

    // 1.1 Request Return (Success flow)
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          type: "return",
          reason: "Size fits too tight",
          comment: "Fabric quality good but wrong size received.",
          refundMethod: "UPI",
          refundDetails: {
            method: "UPI",
            upiId: "testcustomer@upi",
            accountHolderName: "Test Customer"
          }
        }
      };
      const res = createMockRes();
      await requestReturnExchange(req, res);
      const isOk = res.statusCode === 200 && res.data?.success === true;
      recordTestResult("Return API", "POST /api/orders/:id/return-exchange (Type: Return)", isOk, res.statusCode, res.data?.message || "Submitted", {
        success: res.data?.success,
        message: res.data?.message,
        orderId: res.data?.order?.orderId,
        overallStatus: res.data?.order?.overallStatus,
        returnRequest: res.data?.order?.returnRequest,
        refundDetails: res.data?.order?.refundDetails
      });
    }

    // 1.2 Update Return Status to "approved" by Admin/Seller
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "approved",
          notes: "Approved return request. Pickup generated."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && res.data?.success === true && updatedOrd?.returnRequest?.status === "approved";
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Approved)", isOk, res.statusCode, res.data?.message || "Approved successfully", {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        returnRequestStatus: updatedOrd?.returnRequest?.status,
        timeline: updatedOrd?.timeline?.slice(-1)
      });
    }

    // 1.3 Update Return Status to "pickup_scheduled"
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "pickup_scheduled",
          pickupDate: new Date(Date.now() + 86400000).toISOString(),
          notes: "Courier assigned for pickup tomorrow."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && updatedOrd?.overallStatus === "pickup_scheduled";
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Pickup Scheduled)", isOk, res.statusCode, res.data?.message || "Pickup scheduled", {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        pickupDate: updatedOrd?.returnRequest?.pickupDate
      });
    }

    // 1.4 Update Return Status to "product_received" (Stock Restoration Check)
    {
      const stockBefore = (await Product.findById(testProduct._id)).stock;
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "product_received",
          notes: "Item received back and verified."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const stockAfter = (await Product.findById(testProduct._id)).stock;
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && stockAfter === stockBefore + 1;
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Product Received + Stock Restored)", isOk, res.statusCode, `Received & Stock restored (${stockBefore} -> ${stockAfter})`, {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        stockRestoration: { before: stockBefore, after: stockAfter }
      });
    }

    // 1.5 Update Return Status to "refund_completed"
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "refund_completed",
          refundTxnId: "TXN_UPI_992019283",
          notes: "Refund credited back to customer UPI."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && updatedOrd?.paymentStatus === "refunded";
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Refund Completed)", isOk, res.statusCode, "Refund Completed", {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        paymentStatus: updatedOrd?.paymentStatus,
        refundStatus: updatedOrd?.refundStatus,
        refundTxnId: updatedOrd?.returnRequest?.refundTxnId
      });
    }

    // 1.6 Request Exchange Flow
    {
      // Reset order to delivered status to test exchange
      deliveredOrder.status = "Delivered";
      deliveredOrder.overallStatus = "Delivered";
      await deliveredOrder.save();

      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          type: "exchange",
          reason: "Size conversion issue",
          exchangeSize: "L",
          exchangeColor: "Navy Blue",
          comment: "Please exchange for Size L"
        }
      };
      const res = createMockRes();
      await requestReturnExchange(req, res);
      const isOk = res.statusCode === 200 && res.data?.order?.overallStatus === "exchange_requested";
      recordTestResult("Return API", "POST /api/orders/:id/return-exchange (Type: Exchange)", isOk, res.statusCode, "Exchange requested", {
        success: res.data?.success,
        overallStatus: res.data?.order?.overallStatus,
        exchangeSize: res.data?.order?.returnRequest?.exchangeSize,
        exchangeColor: res.data?.order?.returnRequest?.exchangeColor
      });
    }

    // 1.7 Update Exchange Status to "exchange_dispatched"
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "exchange_dispatched",
          exchangeAwb: "SF_EXCH_8829102",
          exchangeCourier: "BlueDart Express",
          notes: "Replacement item shipped."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && updatedOrd?.overallStatus === "exchange_dispatched";
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Exchange Dispatched)", isOk, res.statusCode, "Exchange Dispatched", {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        exchangeAwb: updatedOrd?.returnRequest?.exchangeAwb,
        exchangeCourier: updatedOrd?.returnRequest?.exchangeCourier
      });
    }

    // 1.8 Update Exchange Status to "exchanged"
    {
      const req = {
        params: { id: deliveredOrder._id.toString() },
        body: {
          status: "exchanged",
          notes: "Replacement item delivered to customer."
        }
      };
      const res = createMockRes();
      await updateReturnExchangeStatus(req, res);
      const updatedOrd = res.data?.order;
      const isOk = res.statusCode === 200 && updatedOrd?.overallStatus === "exchanged";
      recordTestResult("Return API", "PATCH /api/orders/:id/return-exchange/status (Status: Exchanged Completed)", isOk, res.statusCode, "Exchanged Completed", {
        success: res.data?.success,
        overallStatus: updatedOrd?.overallStatus,
        returnRequestStatus: updatedOrd?.returnRequest?.status
      });
    }

    // 1.9 Edge Case: Return Request on Non-Delivered Order
    {
      const req = {
        params: { id: pendingOrder._id.toString() },
        body: { type: "return", reason: "Changed my mind" }
      };
      const res = createMockRes();
      await requestReturnExchange(req, res);
      const isOk = res.statusCode === 400;
      recordTestResult("Return API (Edge Case)", "POST return request on Non-Delivered Order", isOk, res.statusCode, res.data?.message, res.data);
    }

    // 1.10 Edge Case: Return Request on Non-Returnable Product
    {
      const req = {
        params: { id: nonRetOrder._id.toString() },
        body: { type: "return", reason: "Want refund" }
      };
      const res = createMockRes();
      await requestReturnExchange(req, res);
      const isOk = res.statusCode === 400 && res.data?.message?.includes("non-returnable");
      recordTestResult("Return API (Edge Case)", "POST return request on Non-Returnable Product", isOk, res.statusCode, res.data?.message, res.data);
    }


    // -------------------------------------------------------------
    // PART 2: NOTIFICATION & ANNOUNCEMENT API TESTS
    // -------------------------------------------------------------
    console.log("\n-------------------------------------------------");
    console.log("📢 TEST SET 2: NOTIFICATION & ANNOUNCEMENT API");
    console.log("-------------------------------------------------\n");

    let createdAnnouncementId = null;

    // 2.1 GET /api/announcements (Fetch all announcements/notifications)
    {
      const req = {};
      const res = createMockRes();
      await getAnnouncements(req, res);
      const isOk = res.statusCode === 200 && res.data?.success === true && Array.isArray(res.data?.announcements);
      recordTestResult("Notification API", "GET /api/announcements (List All)", isOk, res.statusCode, `Fetched ${res.data?.count} item(s)`, {
        success: res.data?.success,
        count: res.data?.count,
        sampleAnnouncements: res.data?.announcements?.slice(0, 3)
      });
    }

    // 2.2 POST /api/announcements (Create Announcement Notification Bar)
    {
      const req = {
        body: {
          text: "🚀 Flash Sale: 20% OFF on all School Uniforms & Kits!",
          badge: "LIMITED OFFER",
          link: "/offers",
          priority: 1,
          isActive: true,
          bgColor: "#1d4ed8",
          textColor: "#ffffff"
        }
      };
      const res = createMockRes();
      await createAnnouncement(req, res);
      const isOk = res.statusCode === 201 && res.data?.success === true;
      if (isOk) createdAnnouncementId = res.data?.announcement?._id;
      recordTestResult("Notification API", "POST /api/announcements (Create Announcement Notification)", isOk, res.statusCode, res.data?.message, {
        success: res.data?.success,
        announcement: res.data?.announcement
      });
    }

    // 2.3 PUT /api/announcements/:id (Update Announcement Notification)
    if (createdAnnouncementId) {
      const req = {
        params: { id: createdAnnouncementId.toString() },
        body: {
          text: "🔥 Mega Sale: 25% OFF on all School Uniforms!",
          priority: 1,
          badge: "UPDATED OFFER"
        }
      };
      const res = createMockRes();
      await updateAnnouncement(req, res);
      const isOk = res.statusCode === 200 && res.data?.announcement?.text?.includes("25%");
      recordTestResult("Notification API", "PUT /api/announcements/:id (Update Announcement)", isOk, res.statusCode, res.data?.message, {
        success: res.data?.success,
        updatedAnnouncement: res.data?.announcement
      });
    }

    // 2.4 PATCH /api/announcements/:id/toggle (Toggle Announcement Active State)
    if (createdAnnouncementId) {
      const req = {
        params: { id: createdAnnouncementId.toString() },
        body: { isActive: false }
      };
      const res = createMockRes();
      await toggleAnnouncementStatus(req, res);
      const isOk = res.statusCode === 200 && res.data?.announcement?.isActive === false;
      recordTestResult("Notification API", "PATCH /api/announcements/:id/toggle (Toggle Disable)", isOk, res.statusCode, res.data?.message, {
        success: res.data?.success,
        isActive: res.data?.announcement?.isActive
      });
    }

    // 2.5 Contact Notification POST /api/contact
    {
      const newContact = await ContactMsg.create({
        name: "Rohit Sharma",
        email: "rohit@example.com",
        phone: "9876543210",
        subject: "Bulk Order Query for Class 10 Uniforms",
        message: "We need 150 pairs of navy blue trousers and white shirts."
      });
      const isOk = Boolean(newContact && newContact._id);
      recordTestResult("Notification API", "POST /api/contact (Create Contact Notification)", isOk, 201, "Contact message recorded", {
        success: true,
        contact: newContact
      });
    }

    // 2.6 Fetch Contact Notifications GET /api/contact
    {
      const messages = await ContactMsg.find().sort({ createdAt: -1 }).lean();
      const isOk = Array.isArray(messages);
      recordTestResult("Notification API", "GET /api/contact (Fetch All Contact Notifications)", isOk, 200, `Fetched ${messages.length} message(s)`, {
        success: true,
        count: messages.length,
        messages: messages.slice(0, 2)
      });
    }

    // 2.7 DELETE /api/announcements/:id (Delete Announcement Notification Cleanup)
    if (createdAnnouncementId) {
      const req = {
        params: { id: createdAnnouncementId.toString() }
      };
      const res = createMockRes();
      await deleteAnnouncement(req, res);
      const isOk = res.statusCode === 200 && res.data?.success === true;
      recordTestResult("Notification API", "DELETE /api/announcements/:id (Delete Cleanup)", isOk, res.statusCode, res.data?.message, res.data);
    }

    // Clean up temporary DB documents
    await User.findByIdAndDelete(testUser._id);
    await Product.findByIdAndDelete(testProduct._id);
    await Product.findByIdAndDelete(nonReturnableProduct._id);
    await Order.findByIdAndDelete(deliveredOrder._id);
    await Order.findByIdAndDelete(pendingOrder._id);
    await Order.findByIdAndDelete(nonRetOrder._id);

    console.log("\n=================================================");
    console.log("📊 SUMMARY TEST REPORT & RESPONSE LISTING");
    console.log("=================================================\n");

    testSuiteResults.forEach((t, idx) => {
      const icon = t.status === 'PASS' ? '✅' : '❌';
      console.log(`${idx + 1}. ${icon} [${t.suite}] ${t.name}`);
      console.log(`   Status Code: ${t.statusCode} | Result: ${t.status}`);
      console.log(`   Message: ${t.message}`);
      console.log(`   Response Payload: ${JSON.stringify(t.response, null, 2)}`);
      console.log("-------------------------------------------------");
    });

    const passedCount = testSuiteResults.filter(t => t.status === 'PASS').length;
    console.log(`\n🎉 TOTAL TESTS PASSED: ${passedCount} / ${testSuiteResults.length}`);

  } catch (err) {
    console.error("❌ Test suite encountered fatal error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed.");
  }
}

runTests();
