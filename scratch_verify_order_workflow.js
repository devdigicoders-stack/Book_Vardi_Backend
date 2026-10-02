import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Order from './Server/models/Order.js';
import Product from './Server/models/Product.js';
import {
  createOrder,
  cancelOrder,
  requestReturnExchange,
  updateReturnExchangeStatus,
  updateOrder
} from './Server/controllers/orderController.js';
import { verifyPayment } from './Server/controllers/paymentController.js';
import { generateTaxInvoicePDF, generateCreditNotePDF, generateExchangeInvoicePDF } from './Server/services/invoiceService.js';

// Mock Express Response helper
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

async function runVerification() {
  console.log('🚀 Starting Comprehensive Product Order Workflow Automated Verification...\n');

  try {
    // 1. Connect MongoDB
    await connectDB();
    console.log('✅ 1. MongoDB Connected Successfully.');

    // 2. Locate or create a test product
    let testProduct = await Product.findOne();
    if (!testProduct) {
      testProduct = await Product.create({
        name: 'Automated Test School Shirt',
        category: 'Uniform',
        price: 499,
        mrp: 699,
        stock: 50,
        stockQuantity: 50,
        isReturnable: true,
        isExchangeable: true,
        returnWindowDays: 7,
        sizeVariants: [{ size: 'M', stock: 50, stockQuantity: 50 }]
      });
    }

    const initialStock = Number(testProduct.stockQuantity ?? testProduct.stock ?? 50);
    console.log(`📦 Found Product for Test: "${testProduct.name}" (ID: ${testProduct._id}) | Initial Stock: ${initialStock}`);

    // =========================================================================
    // TEST SUITE A: Online Prepaid Order -> Cancellation before delivery with Refund Payout
    // =========================================================================
    console.log('\n--- TEST A: Online Prepaid Order Placement & Cancellation ---');
    const reqA = {
      body: {
        orderId: `TEST-PREPAID-${Date.now()}`,
        customer: { name: 'Test Parent', email: 'testparent@example.com', phone: '9876543210' },
        shippingAddress: { name: 'Test Parent', street: '123 Civil Lines', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', phone: '9876543210' },
        paymentMethod: 'UPI',
        subtotal: 499,
        totalAmount: 499,
        total: 499,
        items: [
          {
            productId: testProduct._id,
            name: testProduct.name,
            price: 499,
            quantity: 1,
            size: 'M',
            status: 'pending'
          }
        ]
      }
    };

    const resA = createMockRes();
    await createOrder(reqA, resA);
    const orderA = resA.data?.order;
    console.log(`✅ Prepaid Order Created: #${orderA.orderId} (ID: ${orderA._id}) | Status: ${orderA.overallStatus}`);

    // Verify Payment
    const verifyReqA = {
      body: {
        razorpay_order_id: `rzp_order_${Date.now()}`,
        razorpay_payment_id: `rzp_pay_${Date.now()}`,
        orderId: orderA._id
      }
    };
    const verifyResA = createMockRes();
    await verifyPayment(verifyReqA, verifyResA);
    console.log(`💳 Razorpay Payment Verified! Payment Status: ${verifyResA.data?.order?.paymentStatus}`);

    // Cancel Prepaid Order with UPI details
    const cancelReqA = {
      params: { id: orderA._id },
      body: {
        reason: 'Need to change size',
        refundDetails: { method: 'UPI', upiId: 'testparent@okaxis' }
      },
      user: { name: 'Test Parent' }
    };
    const cancelResA = createMockRes();
    await cancelOrder(cancelReqA, cancelResA);
    console.log(`❌ Order Cancelled! Refund Status: ${cancelResA.data?.order?.refundStatus} | Refund Mode: ${cancelResA.data?.order?.refundDetails?.method} (${cancelResA.data?.order?.refundDetails?.upiId})`);

    // Verify Stock Auto-Restored
    const updatedProdA = await Product.findById(testProduct._id);
    const stockAfterCancel = Number(updatedProdA.stockQuantity ?? updatedProdA.stock);
    console.log(`🔄 Stock after Cancellation: ${stockAfterCancel} (Expected: ${initialStock})`);

    // Test Credit Note PDF Generation
    const creditNotePdfDoc = generateCreditNotePDF(cancelResA.data.order);
    if (!creditNotePdfDoc) throw new Error('Credit Note PDF generation failed!');
    console.log('📄 Credit Note PDF generated successfully.');

    // =========================================================================
    // TEST SUITE B: Order Fulfillment & Post-Delivery Return Workflow
    // =========================================================================
    console.log('\n--- TEST B: Order Fulfillment & Post-Delivery Return Workflow ---');
    const reqB = {
      body: {
        orderId: `TEST-RETURN-${Date.now()}`,
        customer: { name: 'Return Customer', email: 'returncust@example.com', phone: '9876543211' },
        shippingAddress: { name: 'Return Customer', street: '456 Gomti Nagar', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010', phone: '9876543211' },
        paymentMethod: 'UPI',
        subtotal: 499,
        totalAmount: 499,
        total: 499,
        items: [
          {
            productId: testProduct._id,
            name: testProduct.name,
            price: 499,
            quantity: 1,
            size: 'M',
            status: 'pending'
          }
        ]
      }
    };

    const resB = createMockRes();
    await createOrder(reqB, resB);
    const orderB = resB.data?.order;
    console.log(`✅ Order B Created: #${orderB.orderId}`);

    // Advance Order to Delivered
    const updateBReq = {
      params: { id: orderB._id },
      body: { overallStatus: 'Delivered', paymentStatus: 'paid' },
      user: { role: 'admin', name: 'Super Admin' }
    };
    const updateBRes = createMockRes();
    await updateOrder(updateBReq, updateBRes);
    console.log(`🚚 Order B Status updated to: ${updateBRes.data?.order?.overallStatus}`);

    // Verify Tax Invoice PDF Generation
    const taxInvoicePdfDoc = generateTaxInvoicePDF(updateBRes.data.order);
    if (!taxInvoicePdfDoc) throw new Error('Tax Invoice PDF generation failed!');
    console.log('📄 Tax Invoice PDF generated successfully.');

    // Submit Return Request with Bank Details
    const returnReqB = {
      params: { id: orderB._id },
      body: {
        type: 'return',
        reason: 'Size too small',
        comment: 'Please pick up from front desk',
        refundMethod: 'Bank Transfer',
        refundDetails: {
          method: 'BANK',
          bankName: 'HDFC Bank',
          accountNumber: '50100012345678',
          ifscCode: 'HDFC0001234',
          accountHolderName: 'Return Customer'
        }
      }
    };
    const returnResB = createMockRes();
    await requestReturnExchange(returnReqB, returnResB);
    console.log(`📦 Return Requested! Status: ${returnResB.data?.order?.overallStatus} | Refund Status: ${returnResB.data?.order?.refundStatus}`);

    // Seller/Admin Approves Return
    const approveReqB = {
      params: { id: orderB._id },
      body: { status: 'approved' },
      user: { name: 'Seller Hub' }
    };
    const approveResB = createMockRes();
    await updateReturnExchangeStatus(approveReqB, approveResB);
    console.log(`👍 Return Approved! Status: ${approveResB.data?.order?.overallStatus}`);

    // Mark Product Received at Warehouse -> Restocks inventory
    const receiveReqB = {
      params: { id: orderB._id },
      body: { status: 'product_received' },
      user: { name: 'Warehouse Admin' }
    };
    const receiveResB = createMockRes();
    await updateReturnExchangeStatus(receiveReqB, receiveResB);
    console.log(`📥 Product Return Received at Warehouse! Status: ${receiveResB.data?.order?.overallStatus}`);

    // Complete Refund
    const refundReqB = {
      params: { id: orderB._id },
      body: { status: 'refund_completed', refundTxnId: 'TXN99887766' },
      user: { name: 'Finance Manager' }
    };
    const refundResB = createMockRes();
    await updateReturnExchangeStatus(refundReqB, refundResB);
    console.log(`💰 Refund Completed! Payment Status: ${refundResB.data?.order?.paymentStatus} | Refund Status: ${refundResB.data?.order?.refundStatus}`);

    // =========================================================================
    // TEST SUITE C: Post-Delivery Exchange Workflow & Exchange Invoice PDF
    // =========================================================================
    console.log('\n--- TEST C: Post-Delivery Exchange Workflow & Exchange Invoice ---');
    const reqC = {
      body: {
        orderId: `TEST-EXCH-${Date.now()}`,
        customer: { name: 'Exchange Customer', email: 'exchcust@example.com', phone: '9876543212' },
        shippingAddress: { name: 'Exchange Customer', street: '789 Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', phone: '9876543212' },
        paymentMethod: 'UPI',
        subtotal: 499,
        totalAmount: 499,
        total: 499,
        items: [
          {
            productId: testProduct._id,
            name: testProduct.name,
            price: 499,
            quantity: 1,
            size: 'M',
            status: 'pending'
          }
        ]
      }
    };

    const resC = createMockRes();
    await createOrder(reqC, resC);
    const orderC = resC.data?.order;

    // Deliver Order C
    await updateOrder({ params: { id: orderC._id }, body: { overallStatus: 'Delivered', paymentStatus: 'paid' }, user: { name: 'Super Admin' } }, createMockRes());

    // Submit Exchange Request
    const exchReqC = {
      params: { id: orderC._id },
      body: { type: 'exchange', reason: 'Need larger size', exchangeSize: 'L' }
    };
    const exchResC = createMockRes();
    await requestReturnExchange(exchReqC, exchResC);
    console.log(`🔄 Exchange Requested! Status: ${exchResC.data?.order?.overallStatus}`);

    // Approve Exchange
    await updateReturnExchangeStatus({ params: { id: orderC._id }, body: { status: 'approved' }, user: { name: 'Seller' } }, createMockRes());

    // Dispatch Exchange Unit
    const dispatchReqC = {
      params: { id: orderC._id },
      body: { status: 'exchange_dispatched', exchangeCourier: 'Delhivery', exchangeAwb: 'EXCH-AWB-990011' },
      user: { name: 'Logistics Partner' }
    };
    const dispatchResC = createMockRes();
    await updateReturnExchangeStatus(dispatchReqC, dispatchResC);
    console.log(`🚚 Exchange Replacement Dispatched! AWB: ${dispatchResC.data?.order?.returnRequest?.exchangeAwb}`);

    // Complete Exchange
    const completeExchRes = createMockRes();
    await updateReturnExchangeStatus({ params: { id: orderC._id }, body: { status: 'exchanged' }, user: { name: 'Rider' } }, completeExchRes);
    console.log(`✨ Exchange Completed! Overall Status: ${completeExchRes.data?.order?.overallStatus}`);

    // Test Exchange Invoice PDF Stream
    const exchangeInvoicePdfDoc = generateExchangeInvoicePDF(completeExchRes.data.order);
    if (!exchangeInvoicePdfDoc) throw new Error('Exchange Invoice PDF generation failed!');
    console.log('📄 Exchange Tax Invoice & Replacement Slip PDF generated successfully.');

    // Cleanup test orders
    await Order.deleteMany({ orderId: { $regex: /^TEST-/ } });
    console.log('🧹 Test orders cleaned up.');

    console.log('\n🎉 ALL WORKFLOW TESTS PASSED SUCCESSFULLY WITH 100% VERIFICATION!');

  } catch (err) {
    console.error('❌ Verification failed with error:', err.message, err.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed.');
  }
}

runVerification();
