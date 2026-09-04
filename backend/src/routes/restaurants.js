import { Router } from 'express';
import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

const router = Router();

// Helper: Calculate distance in kilometers using Haversine formula
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/restaurants/nearby?lat=...&lng=...&radius=...
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = radius ? parseFloat(radius) : null;

    const restaurants = await Restaurant.find({});

    const styledRestaurants = restaurants
      .map((r) => {
        const restDoc = r.toObject();
        // Fallback check if coordinates exist on the schema
        const rLat = restDoc.lat || restDoc.latitude || (restDoc.location && restDoc.location.lat);
        const rLng = restDoc.lng || restDoc.longitude || (restDoc.location && restDoc.location.lng);

        if (userLat && userLng && rLat && rLng) {
          const distance = getHaversineDistance(userLat, userLng, rLat, rLng);
          return { ...restDoc, distance: Math.round(distance * 10) / 10 };
        }
        return { ...restDoc, distance: null };
      })
      .filter((r) => {
        // If radius is provided and valid, filter out places further than the radius
        if (searchRadius && r.distance !== null) {
          return r.distance <= searchRadius;
        }
        return true;
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    res.json(styledRestaurants);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/restaurants (Standard text search)
router.get('/', async (req, res) => {
  try {
    const q = (req.query.search || '').trim();
    const filter = q
      ? { $or: [{ name: { $regex: q, $options: 'i' } }, { cuisine: { $regex: q, $options: 'i' } }] }
      : {};
    const restaurants = await Restaurant.find(filter).sort({ rating: -1 });
    res.json(restaurants);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/restaurants/:id
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    const menu = await MenuItem.find({ restaurant: restaurant._id });
    res.json({ restaurant, menu });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/restaurants/:id/menu
router.get('/:id/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ restaurant: req.params.id });
    res.json(items);
  } catch (error) {
    console.error('Fetch menu items error:', error);
    res.status(500).json({ message: 'Failed to fetch menu items' });
  }
});

export default router;