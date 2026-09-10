import express from 'express';
import DeliveryBoy from '../models/DeliveryBoy.js';
import authenticateToken from '../middlewares/auth.js';

const router = express.Router();

// Get all delivery boys
router.get('/', authenticateToken, async (req, res) => {
  try {
    const deliveryBoys = await DeliveryBoy.find();
    res.json(deliveryBoys);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create delivery boy
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, phone, status } = req.body;
    const deliveryBoy = new DeliveryBoy({ name, phone, status });
    await deliveryBoy.save();
    res.status(201).json({ message: 'Delivery boy created successfully', deliveryBoy });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update delivery boy
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(id, updates, { new: true });
    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found' });
    }
    res.json({ message: 'Delivery boy updated successfully', deliveryBoy });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete delivery boy
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deliveryBoy = await DeliveryBoy.findByIdAndDelete(id);
    if (!deliveryBoy) {
      return res.status(404).json({ message: 'Delivery boy not found' });
    }
    res.json({ message: 'Delivery boy deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;