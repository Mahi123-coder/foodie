import { Router } from 'express';
import Order from '../models/Order.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.post('/', async (req, res) => {
  try {
    const { restaurant, items, total, address } = req.body;
    if (!restaurant || !items?.length || !total || !address) return res.status(400).json({ message: 'Restaurant, items, total and address are required' });
    const order = await Order.create({ user: req.user.id, restaurant, items, total, address });
    res.status(201).json(order);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/mine', async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).populate('restaurant', 'name image').sort({ createdAt: -1 });
    res.json(orders);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

export default router;
