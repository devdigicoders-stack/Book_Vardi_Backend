import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  minAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'expired'], 
    default: 'active' 
  },
  expiryDate: { type: Date, required: true },
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Store' 
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  createdRole: {
    type: String,
    enum: ['admin', 'seller'],
    default: 'admin'
  },
  applicableProducts: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

export default mongoose.model('Coupon', couponSchema);