import { Router } from 'express';
import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const q = (req.query.search || '').trim();
    const filter = q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { cuisine: { $regex: q, $options: 'i' } }] } : {};
    const restaurants = await Restaurant.find(filter).sort({ rating: -1 });
    res.json(restaurants);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    const menu = await MenuItem.find({ restaurant: restaurant._id });
    res.json({ restaurant, menu });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

export default router;
