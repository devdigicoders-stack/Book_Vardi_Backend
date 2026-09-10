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
  }
}, {
  timestamps: true
});

export default mongoose.model('Coupon', couponSchema);