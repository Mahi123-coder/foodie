import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';

import { auth } from '../middleware/auth.js';
import Order from '../models/Order.js';

const router = Router();


// =============================================================
// AUTHENTICATION
// =============================================================

router.use(auth);


// =============================================================
// RAZORPAY CONFIGURATION
// =============================================================

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

console.log('==============================================');
console.log('RAZORPAY CONFIGURATION');
console.log(
  'RAZORPAY_KEY_ID configured:',
  Boolean(razorpayKeyId)
);
console.log(
  'RAZORPAY_KEY_SECRET configured:',
  Boolean(razorpayKeySecret)
);
console.log('==============================================');


// =============================================================
// RAZORPAY INSTANCE
// =============================================================

const razorpay =
  razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      })
    : null;


// =============================================================
// NORMAL PAYMENT
// CREATE RAZORPAY ORDER
// =============================================================

router.post('/create-order', async (req, res) => {
  try {

    if (!razorpay) {
      return res.status(500).json({
        message:
          'Payment gateway is not configured',
      });
    }

    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({
        message:
          'This order has already been paid for',
      });
    }

    if (
      typeof order.total !== 'number' ||
      !Number.isFinite(order.total) ||
      order.total <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid order amount',
      });
    }

    const razorpayOrder =
      await razorpay.orders.create({
        amount: Math.round(order.total * 100),
        currency: 'INR',
        receipt: `order_${order._id}`,
      });

    order.razorpayOrderId =
      razorpayOrder.id;

    await order.save();

    return res.status(200).json({
      key: razorpayKeyId,
      razorpayOrderId:
        razorpayOrder.id,
      amount:
        razorpayOrder.amount,
      currency:
        razorpayOrder.currency,
      orderId: order._id,
    });

  } catch (error) {

    console.error(
      'RAZORPAY CREATE ORDER ERROR:',
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        'Could not create Razorpay order',
    });
  }
});


// =============================================================
// NORMAL PAYMENT
// VERIFY PAYMENT
// =============================================================

router.post('/verify', async (req, res) => {
  try {

    if (!razorpayKeySecret) {
      return res.status(500).json({
        message:
          'Payment gateway is not configured',
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderId
    ) {
      return res.status(400).json({
        message:
          'Payment details are incomplete',
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }

    if (
      order.razorpayOrderId !==
      razorpay_order_id
    ) {
      return res.status(400).json({
        message:
          'Razorpay order does not match this order',
      });
    }

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          razorpayKeySecret
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');

    const signaturesMatch =
      generatedSignature.length ===
        razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(
          generatedSignature
        ),
        Buffer.from(
          razorpay_signature
        )
      );

    if (!signaturesMatch) {

      order.paymentStatus =
        'FAILED';

      await order.save();

      return res.status(400).json({
        message:
          'Payment verification failed',
      });
    }

    order.paymentStatus = 'PAID';

    order.razorpayPaymentId =
      razorpay_payment_id;

    order.razorpaySignature =
      razorpay_signature;

    await order.save();

    return res.status(200).json({
      message:
        'Payment verified successfully 🎉',
      order,
    });

  } catch (error) {

    console.error(
      'RAZORPAY PAYMENT VERIFICATION ERROR:',
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        'Could not verify payment',
    });
  }
});


// =============================================================
// GROUP PAYMENT
// CREATE RAZORPAY ORDER FOR MEMBER
// =============================================================

router.post(
  '/group/create-order',
  async (req, res) => {

    try {

      if (!razorpay) {
        return res.status(500).json({
          message:
            'Payment gateway is not configured',
        });
      }

      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({
          message: 'Order ID is required',
        });
      }

      // Find group order
      const order =
        await Order.findOne({
          _id: orderId,
          isGroupOrder: true,
        });

      if (!order) {
        return res.status(404).json({
          message:
            'Group order not found',
        });
      }

      // Find logged-in member
      const member =
        order.groupMembers.find(
          member =>
            member.user.toString() ===
            req.user.id.toString()
        );

      if (!member) {
        return res.status(403).json({
          message:
            'You are not a member of this group order',
        });
      }

      // Already paid
      if (
        member.paymentStatus ===
        'PAID'
      ) {
        return res.status(400).json({
          message:
            'You have already paid your share',
        });
      }

      // Validate share
      if (
        typeof member.shareAmount !==
          'number' ||
        !Number.isFinite(
          member.shareAmount
        ) ||
        member.shareAmount <= 0
      ) {
        return res.status(400).json({
          message:
            'Your order share is invalid',
        });
      }

      // Create Razorpay order
      const razorpayOrder =
        await razorpay.orders.create({
          amount: Math.round(
            member.shareAmount * 100
          ),
          currency: 'INR',
          receipt:
            `group_${order._id}_${member.user}`,
        });

      // Save Razorpay order ID
      member.razorpayOrderId =
        razorpayOrder.id;

      await order.save();

      return res.status(200).json({
        key: razorpayKeyId,

        razorpayOrderId:
          razorpayOrder.id,

        amount:
          razorpayOrder.amount,

        currency:
          razorpayOrder.currency,

        orderId:
          order._id,

        shareAmount:
          member.shareAmount,
      });

    } catch (error) {

      console.error(
        'GROUP RAZORPAY CREATE ORDER ERROR:',
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          'Could not create group payment',
      });
    }
  }
);


// =============================================================
// GROUP PAYMENT
// VERIFY MEMBER PAYMENT
// =============================================================

router.post(
  '/group/verify',
  async (req, res) => {

    try {

      if (!razorpayKeySecret) {
        return res.status(500).json({
          message:
            'Payment gateway is not configured',
        });
      }

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId,
      } = req.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !orderId
      ) {
        return res.status(400).json({
          message:
            'Payment details are incomplete',
        });
      }

      // Find group order
      const order =
        await Order.findOne({
          _id: orderId,
          isGroupOrder: true,
        });

      if (!order) {
        return res.status(404).json({
          message:
            'Group order not found',
        });
      }

      // Find logged-in member
      const member =
        order.groupMembers.find(
          member =>
            member.user.toString() ===
            req.user.id.toString()
        );

      if (!member) {
        return res.status(403).json({
          message:
            'You are not a member of this group order',
        });
      }

      // Check Razorpay order ID
      if (
        member.razorpayOrderId !==
        razorpay_order_id
      ) {
        return res.status(400).json({
          message:
            'Razorpay order does not match your group share',
        });
      }

      // Generate expected signature
      const generatedSignature =
        crypto
          .createHmac(
            'sha256',
            razorpayKeySecret
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest('hex');

      // Compare signatures
      const signaturesMatch =
        generatedSignature.length ===
          razorpay_signature.length &&
        crypto.timingSafeEqual(
          Buffer.from(
            generatedSignature
          ),
          Buffer.from(
            razorpay_signature
          )
        );

      if (!signaturesMatch) {

        member.paymentStatus =
          'FAILED';

        await order.save();

        return res.status(400).json({
          message:
            'Payment verification failed',
        });
      }

      // Mark member as paid
      member.paymentStatus =
        'PAID';

      member.razorpayPaymentId =
        razorpay_payment_id;

      // Check whether everyone has paid
      const everyonePaid =
        order.groupMembers.every(
          member =>
            member.paymentStatus ===
            'PAID'
        );

      order.allMembersPaid =
        everyonePaid;

      // If everyone paid,
      // mark the complete order as paid
      if (everyonePaid) {
        order.paymentStatus =
          'PAID';

        order.status =
          'PLACED';
      }

      await order.save();

      return res.status(200).json({
        message:
          everyonePaid
            ? 'Everyone has paid! Group order confirmed 🎉'
            : 'Your payment was verified successfully 🎉',

        yourShare:
          member.shareAmount,

        allMembersPaid:
          everyonePaid,

        order,
      });

    } catch (error) {

      console.error(
        'GROUP RAZORPAY VERIFY ERROR:',
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          'Could not verify group payment',
      });
    }
  }
);


// =============================================================
// EXPORT
// =============================================================

export default router;