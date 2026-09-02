import express from 'express';
import crypto from 'crypto';

import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();


// =========================================================
// AUTHENTICATION
// =========================================================

router.use(auth);


// =========================================================
// CREATE GROUP ORDER
// =========================================================

router.post('/create', async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      restaurant,
      address
    } = req.body;

    if (!restaurant || !address) {
      return res.status(400).json({
        message: 'restaurant and address are required'
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
    console.error(
      'Create group order error:',
      error
    );

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
      groupCode: req.params.groupCode.toUpperCase(),
      isGroupOrder: true
    })
      .populate(
        'groupMembers.user',
        'name email'
      )
      .populate(
        'groupMembers.items.menuItem'
      );

    if (!order) {
      return res.status(404).json({
        message: 'Group order not found'
      });
    }

    res.json(order);

  } catch (error) {
    console.error(
      'Get group order error:',
      error
    );

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
    const userId = req.user.id;

    const {
      name
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: 'name is required'
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

    // Prevent same user joining twice
    const alreadyJoined =
      order.groupMembers.some(
        member =>
          member.user.toString() ===
          userId.toString()
      );

    if (alreadyJoined) {
      return res.status(400).json({
        message: 'User already joined this group'
      });
    }

    order.groupMembers.push({
      user: userId,

      name: name.trim(),

      items: [],

      shareAmount: 0,

      paymentStatus: 'PENDING'
    });

    await order.save();

    // Populate before returning
    await order.populate(
      'groupMembers.user',
      'name email'
    );

    res.json({
      message: 'Joined group successfully',

      order
    });

  } catch (error) {
    console.error(
      'Join group error:',
      error
    );

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
    const userId = req.user.id;

    const {
      menuItemId,
      quantity
    } = req.body;

    if (!menuItemId || !quantity) {
      return res.status(400).json({
        message:
          'menuItemId and quantity are required'
      });
    }

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity <= 0
    ) {
      return res.status(400).json({
        message:
          'quantity must be a positive integer'
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

    // Find current logged-in member
    const member = order.groupMembers.find(
      member =>
        member.user.toString() ===
        userId.toString()
    );

    if (!member) {
      return res.status(403).json({
        message: 'Join the group first'
      });
    }

    // Do not allow adding items after payment
    if (member.paymentStatus === 'PAID') {
      return res.status(400).json({
        message:
          'You have already paid and cannot modify your items'
      });
    }

    const menuItem =
      await MenuItem.findById(menuItemId);

    if (!menuItem) {
      return res.status(404).json({
        message: 'Menu item not found'
      });
    }

    // Check whether member already has this item
    const existingItem =
      member.items.find(
        item =>
          item.menuItem.toString() ===
          menuItemId.toString()
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

    // Calculate this member's share
    member.shareAmount =
      member.items.reduce(
        (sum, item) =>
          sum +
          Number(item.price) *
          Number(item.quantity),
        0
      );

    // Calculate entire group total
    order.total =
      order.groupMembers.reduce(
        (total, member) =>
          total +
          Number(member.shareAmount || 0),
        0
      );

    // If items are changed before payment,
    // make sure overall payment state stays pending
    order.allMembersPaid = false;

    order.paymentStatus = 'PENDING';

    await order.save();

    res.json({
      message: 'Item added successfully',

      memberShare:
        member.shareAmount,

      groupTotal:
        order.total,

      order
    });

  } catch (error) {
    console.error(
      'Add group item error:',
      error
    );

    res.status(500).json({
      message: 'Failed to add item'
    });
  }
});


// =========================================================
// GET MEMBER SHARE
// =========================================================

router.get(
  '/:groupCode/share/:userId',
  async (req, res) => {
    try {
      const loggedInUserId =
        req.user.id;

      // A user can only view their own share
      if (
        loggedInUserId.toString() !==
        req.params.userId.toString()
      ) {
        return res.status(403).json({
          message:
            'You can only view your own share'
        });
      }

      const order =
        await Order.findOne({
          groupCode:
            req.params.groupCode.toUpperCase(),

          isGroupOrder: true
        });

      if (!order) {
        return res.status(404).json({
          message:
            'Group order not found'
        });
      }

      const member =
        order.groupMembers.find(
          member =>
            member.user.toString() ===
            loggedInUserId.toString()
        );

      if (!member) {
        return res.status(404).json({
          message: 'Member not found'
        });
      }

      res.json({
        name: member.name,

        items: member.items,

        shareAmount:
          member.shareAmount,

        paymentStatus:
          member.paymentStatus
      });

    } catch (error) {
      console.error(
        'Get share error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to get member share'
      });
    }
  }
);


export default router;