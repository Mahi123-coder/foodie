import { Router } from 'express';
import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = Router();

router.use(adminMiddleware);

// Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const restaurants = await Restaurant.countDocuments();
    const menuItems = await MenuItem.countDocuments();
    const users = await User.countDocuments();
    const orders = await Order.countDocuments();

    const revenueResult = await Order.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);

    const revenue = revenueResult[0]?.total || 0;

    res.json({
      restaurants,
      menuItems,
      users,
      orders,
      revenue
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all restaurants
router.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ rating: -1 });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('restaurant', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Create restaurant
router.post('/restaurants', async (req, res) => {
  try {
    const restaurant = await Restaurant.create(req.body);

    res.status(201).json(restaurant);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Update restaurant
router.put('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found'
      });
    }

    res.json(restaurant);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Delete restaurant
router.delete('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(
      req.params.id
    );

    if (!restaurant) {
      return res.status(404).json({
        message: 'Restaurant not found'
      });
    }

    res.json({
      message: 'Restaurant deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});
// Get all menu items
router.get('/menu-items', async (req, res) => {
  try {
    const menuItems = await MenuItem.find()
      .populate('restaurant', 'name')
      .sort({ name: 1 });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});

// Create menu item
router.post('/menu-items', async (req, res) => {
  try {
    const menuItem = await MenuItem.create(req.body);

    res.status(201).json(menuItem);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Update menu item
router.put('/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!menuItem) {
      return res.status(404).json({
        message: 'Menu item not found'
      });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});

// Delete menu item
router.delete('/menu-items/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(
      req.params.id
    );

    if (!menuItem) {
      return res.status(404).json({
        message: 'Menu item not found'
      });
    }

    res.json({
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
});
export default router;