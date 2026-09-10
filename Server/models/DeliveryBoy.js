import mongoose from 'mongoose';

const deliveryBoySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  orders: { type: Number, default: 0 }
}, {
  timestamps: true
});

export default mongoose.model('DeliveryBoy', deliveryBoySchema);