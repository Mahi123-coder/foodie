import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

const router = express.Router();


// =========================================================
// CREATE GROUP ORDER
// =========================================================

router.post('/create', async (req, res) => {
  try {
    const {
      userId,
      restaurant,
      address
    } = req.body;

    if (!userId || !restaurant || !address) {
      return res.status(400).json({
        message: 'userId, restaurant and address are required'
      });
    }

    // Generate short unique group code
    const groupCode = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase();

    const order = await Order.create({
      user: userId,
      restaurant,
      address,
      total: 0,

      isGroupOrder: true,
      groupCode,

      groupMembers: [
        {
          user: userId,
          name: 'Host',
          items: [],
          shareAmount: 0,
          paymentStatus: 'PENDING'
        }
      ],

      allMembersPaid: false,
      status: 'PLACED',
      paymentStatus: 'PENDING'
    });

    res.status(201).json({
      message: 'Group order created',
      orderId: order._id,
      groupCode: order.groupCode,
      order
    });

  } catch (error) {
    console.error('Create group order error:', error);

    res.status(500).json({
      message: 'Failed to create group order'
    });
  }
});


// =========================================================
// GET GROUP ORDER
// =========================================================

router.get('/:groupCode', async (req, res) => {
  try {

    const order = await Order.findOne({
      groupCode: req.params.groupCode,
      isGroupOrder: true
    })
      .populate('groupMembers.user', 'name email')
      .populate('groupMembers.items.menuItem');

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    res.json(order);

  } catch (error) {
    console.error('Get group order error:', error);

    res.status(500).json({
      message: 'Failed to get group order'
    });
  }
});


// =========================================================
// JOIN GROUP ORDER
// =========================================================

router.post('/:groupCode/join', async (req, res) => {
  try {

    const {
      userId,
      name
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        message: 'userId is required'
      });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode,
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    // Prevent same user joining twice
    const alreadyJoined = order.groupMembers.some(
      member => member.user.toString() === userId
    );

    if (alreadyJoined) {
      return res.status(400).json({
        message: 'User already joined this group'
      });
    }

    order.groupMembers.push({
      user: userId,
      name: name || 'Member',
      items: [],
      shareAmount: 0,
      paymentStatus: 'PENDING'
    });

    await order.save();

    res.json({
      message: 'Joined group successfully',
      order
    });

  } catch (error) {
    console.error('Join group error:', error);

    res.status(500).json({
      message: 'Failed to join group'
    });
  }
});


// =========================================================
// ADD ITEM TO GROUP ORDER
// =========================================================

router.post('/:groupCode/items', async (req, res) => {
  try {

    const {
      userId,
      menuItemId,
      quantity
    } = req.body;

    if (!userId || !menuItemId || !quantity) {
      return res.status(400).json({
        message: 'userId, menuItemId and quantity are required'
      });
    }

    const order = await Order.findOne({
      groupCode: req.params.groupCode,
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    const member = order.groupMembers.find(
      member => member.user.toString() === userId
    );

    if (!member) {
      return res.status(403).json({
        message: 'Join the group first'
      });
    }

    const menuItem = await MenuItem.findById(menuItemId);

    if (!menuItem) {
      return res.status(404).json({
        message: 'Menu item not found'
      });
    }

    // Check whether member already has this item
    const existingItem = member.items.find(
      item => item.menuItem.toString() === menuItemId
    );

    if (existingItem) {

      existingItem.quantity += Number(quantity);

    } else {

      member.items.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: Number(quantity)
      });

    }

    // Calculate this member's share
    member.shareAmount = member.items.reduce(
      (sum, item) =>
        sum + (item.price * item.quantity),
      0
    );

    // Calculate entire group total
    order.total = order.groupMembers.reduce(
      (total, member) =>
        total + member.shareAmount,
      0
    );

    await order.save();

    res.json({
      message: 'Item added successfully',
      memberShare: member.shareAmount,
      groupTotal: order.total,
      order
    });

  } catch (error) {
    console.error('Add group item error:', error);

    res.status(500).json({
      message: 'Failed to add item'
    });
  }
});


// =========================================================
// GET MEMBER SHARE
// =========================================================

router.get('/:groupCode/share/:userId', async (req, res) => {
  try {

    const order = await Order.findOne({
      groupCode: req.params.groupCode,
      isGroupOrder: true
    });

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    const member = order.groupMembers.find(
      member => member.user.toString() === req.params.userId
    );

    if (!member) {
      return res.status(404).json({
        message: 'Member not found'
      });
    }

    res.json({
      name: member.name,
      items: member.items,
      shareAmount: member.shareAmount,
      paymentStatus: member.paymentStatus
    });

  } catch (error) {
    console.error('Get share error:', error);

    res.status(500).json({
      message: 'Failed to get member share'
    });
  }
});


export default router;