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
// RAZORPAY INSTANCE
// =============================================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// =============================================================
// CREATE RAZORPAY ORDER
// =============================================================

router.post('/create-order', async (req, res) => {
  try {

    const { orderId } = req.body;


    // ---------------------------------------------------------
    // VALIDATE ORDER ID
    // ---------------------------------------------------------

    if (!orderId) {
      return res.status(400).json({
        message: 'Order ID is required',
      });
    }


    // ---------------------------------------------------------
    // FIND FOODIE ORDER
    // ---------------------------------------------------------

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id,
    });


    if (!order) {
      return res.status(404).json({
        message: 'Order not found',
      });
    }


    // ---------------------------------------------------------
    // PREVENT PAYMENT FOR ALREADY PAID ORDER
    // ---------------------------------------------------------

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({
        message: 'This order has already been paid for',
      });
    }


    // ---------------------------------------------------------
    // VALIDATE TOTAL
    // ---------------------------------------------------------

    if (
      typeof order.total !== 'number' ||
      order.total <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid order amount',
      });
    }


    // ---------------------------------------------------------
    // CREATE RAZORPAY ORDER
    // ---------------------------------------------------------

    const razorpayOrder =
      await razorpay.orders.create({

        // Razorpay expects amount in paise
        amount: Math.round(
          order.total * 100
        ),

        currency: 'INR',

        receipt:
          `order_${order._id}`,

      });


    // ---------------------------------------------------------
    // SAVE RAZORPAY ORDER ID
    // ---------------------------------------------------------

    order.razorpayOrderId =
      razorpayOrder.id;

    await order.save();


    // ---------------------------------------------------------
    // SEND RAZORPAY DATA TO FRONTEND
    // ---------------------------------------------------------

    return res.status(200).json({

      key:
        process.env.RAZORPAY_KEY_ID,

      razorpayOrderId:
        razorpayOrder.id,

      amount:
        razorpayOrder.amount,

      currency:
        razorpayOrder.currency,

      orderId:
        order._id,

    });

  } catch (error) {

    console.error(
      '=============================================='
    );

    console.error(
      'RAZORPAY CREATE ORDER ERROR'
    );

    console.error(
      error
    );

    console.error(
      '=============================================='
    );


    return res.status(500).json({

      message:
        error.message ||
        'Could not create Razorpay order',

    });

  }
});


// =============================================================
// VERIFY RAZORPAY PAYMENT
// =============================================================

router.post('/verify', async (req, res) => {
  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;


    // ---------------------------------------------------------
    // VALIDATE PAYMENT DATA
    // ---------------------------------------------------------

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


    // ---------------------------------------------------------
    // FIND USER'S ORDER
    // ---------------------------------------------------------

    const order =
      await Order.findOne({

        _id: orderId,

        user: req.user.id,

      });


    if (!order) {

      return res.status(404).json({

        message:
          'Order not found',

      });

    }


    // ---------------------------------------------------------
    // VERIFY RAZORPAY ORDER ID
    // ---------------------------------------------------------

    if (
      order.razorpayOrderId !==
      razorpay_order_id
    ) {

      return res.status(400).json({

        message:
          'Razorpay order does not match this order',

      });

    }


    // ---------------------------------------------------------
    // CREATE EXPECTED SIGNATURE
    // ---------------------------------------------------------

    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest('hex');


    // ---------------------------------------------------------
    // COMPARE SIGNATURES
    // ---------------------------------------------------------

    const signaturesMatch =
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpay_signature)
      );


    if (!signaturesMatch) {

      order.paymentStatus = 'FAILED';

      await order.save();

      return res.status(400).json({

        message:
          'Payment verification failed',

      });

    }


    // ---------------------------------------------------------
    // PAYMENT SUCCESS
    // ---------------------------------------------------------

    order.paymentStatus =
      'PAID';

    order.razorpayPaymentId =
      razorpay_payment_id;

    order.razorpaySignature =
      razorpay_signature;


    await order.save();


    // ---------------------------------------------------------
    // SEND SUCCESS RESPONSE
    // ---------------------------------------------------------

    return res.status(200).json({

      message:
        'Payment verified successfully 🎉',

      order,

    });

  } catch (error) {

    console.error(
      '=============================================='
    );

    console.error(
      'RAZORPAY PAYMENT VERIFICATION ERROR'
    );

    console.error(
      error
    );

    console.error(
      '=============================================='
    );


    return res.status(500).json({

      message:
        error.message ||
        'Could not verify payment',

    });

  }
});


// =============================================================
// EXPORT ROUTER
// =============================================================

export default router;