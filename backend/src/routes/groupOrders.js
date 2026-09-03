import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';

import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Initialize Razorpay Instance
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Protect all group order routes with authentication
router.use(auth);

// =========================================================
// CREATE GROUP ORDER
// =========================================================
router.post('/create', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { restaurant, address } = req.body;

    if (!restaurant || !address) {
      return res.status(400).json({
        message: 'restaurant and address are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurant)) {
      return res.status(400).json({
        message: 'Invalid restaurant ID. Must be a valid 24-character ObjectId'
      });
    }

    const groupCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const order = await Order.create({
      user: userId,
      restaurant,
      address,
      total: 0,
      isGroupOrder: true,
      groupCode,
      splitMode: 'ITEMIZED',
      groupMembers: [
        {
          user: userId,
          name: req.user.name || 'Host',
          items: [],
          shareAmount: 0,
          paymentStatus: 'PENDING'
        }
      ],
      allMembersPaid: false,
      status: 'PLACED',
      paymentStatus: 'PENDING'
    });

    return res.status(201).json({
      message: 'Group order created',
      orderId: order._id,
      groupCode: order.groupCode,
      order
    });
  } catch (error) {
    console.error('Create group order error:', error);
    return res.status(500).json({
      message: error.message || 'Failed to create group order'
    });
  }
});

// =========================================================
// GET GROUP ORDER
// =========================================================
router.get('/:groupCode', async (req, res) => {
  try {
    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    })
      .populate('restaurant')
      .populate('groupMembers.user', 'name email')
      .populate('groupMembers.items.menuItem');

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    return res.json(order);
  } catch (error) {
    console.error('Get group order error:', error);
    return res.status(500).json({
      message: 'Failed to get group order'
    });
  }
});

// =========================================================
// JOIN GROUP ORDER (With Safe Re-entry)
// =========================================================
router.post('/:groupCode/join', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { name } = req.body;

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    })
      .populate('restaurant')
      .populate('groupMembers.user', 'name email')
      .populate('groupMembers.items.menuItem');

    if (!order) {
      return res.status(404).json({ message: 'Group order not found' });
    }

    const alreadyJoined = order.groupMembers.some(
      (member) => member.user && (member.user._id || member.user).toString() === userId.toString()
    );

    if (alreadyJoined) {
      return res.json({
        message: 'Welcome back to the group!',
        order
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required to join' });
    }

    order.groupMembers.push({
      user: userId,
      name: name.trim(),
      items: [],
      shareAmount: 0,
      paymentStatus: 'PENDING'
    });

    if (order.splitMode === 'EQUAL' && order.groupMembers.length > 0) {
      const equalShare = Math.round(order.total / order.groupMembers.length);
      order.groupMembers.forEach((m) => {
        m.shareAmount = equalShare;
      });
    }

    await order.save();
    await order.populate('restaurant');
    await order.populate('groupMembers.user', 'name email');

    return res.json({
      message: 'Joined group successfully',
      order
    });
  } catch (error) {
    console.error('Join group error:', error);
    return res.status(500).json({
      message: 'Failed to join group'
    });
  }
});

// =========================================================
// ADD ITEM TO GROUP ORDER
// =========================================================
router.post('/:groupCode/items', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { menuItemId, quantity } = req.body;

    if (!menuItemId || !quantity) {
      return res.status(400).json({
        message: 'menuItemId and quantity are required'
      });
    }

    const numericQuantity = Number(quantity);
    if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({
        message: 'quantity must be a positive integer'
      });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    const member = order.groupMembers.find(
      (m) => m.user && (m.user._id || m.user).toString() === userId.toString()
    );

    if (!member) {
      return res.status(403).json({
        message: 'Join the group first'
      });
    }

    if (member.paymentStatus === 'PAID') {
      return res.status(400).json({
        message: 'You have already paid and cannot modify your items'
      });
    }

    const menuItem = await MenuItem.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        message: 'Menu item not found'
      });
    }

    const existingItem = member.items.find(
      (item) => item.menuItem && item.menuItem.toString() === menuItemId.toString()
    );

    if (existingItem) {
      existingItem.quantity += numericQuantity;
    } else {
      member.items.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: numericQuantity
      });
    }

    order.total = order.groupMembers.reduce((sum, m) => {
      const memberTotal = m.items.reduce(
        (iSum, item) => iSum + Number(item.price) * Number(item.quantity),
        0
      );
      return sum + memberTotal;
    }, 0);

    if (order.splitMode === 'EQUAL' && order.groupMembers.length > 0) {
      const equalShare = Math.round(order.total / order.groupMembers.length);
      order.groupMembers.forEach((m) => {
        m.shareAmount = equalShare;
      });
    } else {
      order.groupMembers.forEach((m) => {
        m.shareAmount = m.items.reduce(
          (iSum, item) => iSum + Number(item.price) * Number(item.quantity),
          0
        );
      });
    }

    order.allMembersPaid = false;
    order.paymentStatus = 'PENDING';

    await order.save();

    return res.json({
      message: 'Item added successfully',
      memberShare: member.shareAmount,
      groupTotal: order.total,
      order
    });
  } catch (error) {
    console.error('Add group item error:', error);
    return res.status(500).json({
      message: 'Failed to add item'
    });
  }
});

// =========================================================
// CLEAR LOGGED-IN MEMBER ITEMS FROM GROUP ORDER
// =========================================================
router.post('/:groupCode/clear-my-items', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({ message: 'Group order room not found' });
    }

    const member = order.groupMembers.find(
      (m) => m.user && (m.user._id || m.user).toString() === userId.toString()
    );

    if (!member) {
      return res.status(400).json({ message: 'Member not found in group' });
    }

    // Clear items and reset share amount
    member.items = [];
    member.shareAmount = 0;

    // Recalculate group order total
    order.total = order.groupMembers.reduce((sum, m) => {
      const memberTotal = m.items.reduce(
        (iSum, item) => iSum + Number(item.price) * Number(item.quantity),
        0
      );
      return sum + memberTotal;
    }, 0);

    // Recalculate member shares based on current split mode
    if (order.splitMode === 'EQUAL' && order.groupMembers.length > 0) {
      const equalShare = Math.round(order.total / order.groupMembers.length);
      order.groupMembers.forEach((m) => {
        m.shareAmount = equalShare;
      });
    } else {
      order.groupMembers.forEach((m) => {
        m.shareAmount = m.items.reduce(
          (iSum, item) => iSum + Number(item.price) * Number(item.quantity),
          0
        );
      });
    }

    await order.save();

    return res.json({
      message: 'Cleared items successfully',
      order
    });
  } catch (error) {
    console.error('Clear items error:', error);
    return res.status(500).json({ message: error.message || 'Failed to clear items' });
  }
});

// =========================================================
// TOGGLE SPLIT MODE
// =========================================================
router.post('/:groupCode/split-mode', async (req, res) => {
  try {
    const { splitMode } = req.body;

    if (!['ITEMIZED', 'EQUAL'].includes(splitMode)) {
      return res.status(400).json({ message: 'Invalid split mode' });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({ message: 'Group order not found' });
    }

    order.splitMode = splitMode;
    const memberCount = order.groupMembers.length;

    if (splitMode === 'EQUAL' && memberCount > 0) {
      const equalShare = Math.round(order.total / memberCount);
      order.groupMembers.forEach((m) => {
        m.shareAmount = equalShare;
      });
    } else {
      order.groupMembers.forEach((m) => {
        m.shareAmount = m.items.reduce(
          (sum, it) => sum + Number(it.price) * Number(it.quantity),
          0
        );
      });
    }

    await order.save();
    return res.json({ message: `Split mode updated to ${splitMode}`, order });
  } catch (error) {
    console.error('Split mode update error:', error);
    return res.status(500).json({ message: 'Failed to update split mode' });
  }
});

// =========================================================
// 1. CREATE RAZORPAY ORDER FOR MEMBER SHARE
// =========================================================
router.post('/:groupCode/create-razorpay-order', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({ message: 'Group order not found' });
    }

    const member = order.groupMembers.find(
      (m) => m.user && (m.user._id || m.user).toString() === userId.toString()
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found in this group' });
    }

    if (member.shareAmount <= 0) {
      return res.status(400).json({ message: 'No payable balance found' });
    }

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(member.shareAmount * 100),
      currency: 'INR',
      receipt: `grp_${order.groupCode}_${userId.toString().slice(-4)}`
    });

    member.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Razorpay create order error:', error);
    return res.status(500).json({ message: 'Failed to create payment order' });
  }
});

// =========================================================
// 2. VERIFY RAZORPAY PAYMENT & MARK AS PAID
// =========================================================
router.post('/:groupCode/verify-payment', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({ message: 'Group order not found' });
    }

    const member = order.groupMembers.find(
      (m) => m.user && (m.user._id || m.user).toString() === userId.toString()
    );

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    member.paymentStatus = 'PAID';
    member.razorpayPaymentId = razorpay_payment_id;

    const allPaid = order.groupMembers
      .filter((m) => m.shareAmount > 0)
      .every((m) => m.paymentStatus === 'PAID');

    order.allMembersPaid = allPaid;
    if (allPaid) {
      order.paymentStatus = 'PAID';
      order.status = 'CONFIRMED';
    }

    await order.save();

    return res.json({
      message: 'Payment verified and marked as PAID! 🎉',
      order
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ message: 'Payment verification failed' });
  }
});

// =========================================================
// GET MEMBER SHARE
// =========================================================
router.get('/:groupCode/share/:userId', async (req, res) => {
  try {
    const loggedInUserId = req.user.id || req.user._id;

    if (loggedInUserId.toString() !== req.params.userId.toString()) {
      return res.status(403).json({
        message: 'You can only view your own share'
      });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    const member = order.groupMembers.find(
      (m) => m.user && (m.user._id || m.user).toString() === loggedInUserId.toString()
    );

    if (!member) {
      return res.status(404).json({
        message: 'Member not found'
      });
    }

    return res.json({
      name: member.name,
      items: member.items,
      shareAmount: member.shareAmount,
      paymentStatus: member.paymentStatus
    });
  } catch (error) {
    console.error('Get share error:', error);
    return res.status(500).json({
      message: 'Failed to get member share'
    });
  }
});

export default router;