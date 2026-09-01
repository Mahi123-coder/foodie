import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({

  // =========================================================
  // USER
  // =========================================================

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },


  // =========================================================
  // RESTAURANT
  // =========================================================

  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },


  // =========================================================
  // ITEMS
  // =========================================================

  items: [
    {
      menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem'
      },

      name: {
        type: String
      },

      price: {
        type: Number
      },

      quantity: {
        type: Number
      }
    }
  ],


  // =========================================================
  // TOTAL
  // =========================================================

  total: {
    type: Number,
    required: true
  },


  // =========================================================
  // ORDER STATUS
  // =========================================================

  status: {
    type: String,

    enum: [
      'PLACED',
      'PREPARING',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    ],

    default: 'PLACED'
  },


  // =========================================================
  // PAYMENT STATUS
  // =========================================================

  paymentStatus: {
    type: String,

    enum: [
      'PENDING',
      'PAID',
      'FAILED'
    ],

    default: 'PENDING'
  },


  // =========================================================
  // RAZORPAY ORDER ID
  // =========================================================

  razorpayOrderId: {
    type: String,
    default: null
  },


  // =========================================================
  // RAZORPAY PAYMENT ID
  // =========================================================

  razorpayPaymentId: {
    type: String,
    default: null
  },


  // =========================================================
  // DELIVERY ADDRESS
  // =========================================================

  address: {
    type: String,
    required: true
  },


  // =========================================================
  // CREATED AT
  // =========================================================

  createdAt: {
    type: Date,
    default: Date.now
  }

});

export default mongoose.model('Order', orderSchema);