import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    // =========================================================
    // USER (Order Creator / Host)
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
    // ITEMS (Standard single order items)
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
        },
        isSharedAddOn: {
          type: Boolean,
          default: false
        }
      }
    ],

    // =========================================================
    // TOTAL
    // =========================================================
    total: {
      type: Number,
      required: true,
      default: 0
    },

    // =========================================================
    // ORDER STATUS
    // =========================================================
    status: {
      type: String,
      enum: [
        'PLACED',
        'CONFIRMED',
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
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING'
    },

    // =========================================================
    // RAZORPAY DETAILS
    // =========================================================
    razorpayOrderId: {
      type: String,
      default: null
    },

    razorpayPaymentId: {
      type: String,
      default: null
    },

    razorpaySignature: {
      type: String,
      default: null
    },

    // =========================================================
    // GROUP ORDER
    // =========================================================
    isGroupOrder: {
      type: Boolean,
      default: false
    },

    // Unique code used to invite people
    groupCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true
    },

    // Mode of splitting bill
    splitMode: {
      type: String,
      enum: ['ITEMIZED', 'EQUAL'],
      default: 'ITEMIZED'
    },

    // People participating in the group order
    groupMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        name: {
          type: String
        },
        // Food items selected by this member
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
            },
            // Preserves idempotency and flags fractional shared items
            isSharedAddOn: {
              type: Boolean,
              default: false
            }
          }
        ],
        // Amount this person has to pay
        shareAmount: {
          type: Number,
          default: 0
        },
        // Individual payment status
        paymentStatus: {
          type: String,
          enum: ['PENDING', 'PAID', 'FAILED'],
          default: 'PENDING'
        },
        razorpayOrderId: {
          type: String,
          default: null
        },
        razorpayPaymentId: {
          type: String,
          default: null
        }
      }
    ],

    // Whether everyone has paid
    allMembersPaid: {
      type: Boolean,
      default: false
    },

    // =========================================================
    // DELIVERY ADDRESS
    // =========================================================
    address: {
      type: String,
      required: true,
      trim: true
    },

    // =========================================================
    // CREATED AT
    // =========================================================
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('Order', orderSchema);