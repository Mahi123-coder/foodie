import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },

    cuisine: [String],

    rating: {
      type: Number,
      default: 4.0,
      min: 0,
      max: 5
    },

    deliveryTime: {
      type: Number,
      default: 30
    },

    image: String,

    location: String,

    // Map coordinates
    latitude: {
      type: Number
    },

    longitude: {
      type: Number
    },

    priceForTwo: Number,

    isVeg: {
      type: Boolean,
      default: false
    }
  },
  {
    // Enables virtual fields to appear in JSON responses
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    timestamps: true
  }
);

// Virtual field to link MenuItems where item.restaurant === restaurant._id
restaurantSchema.virtual('menuItems', {
  ref: 'MenuItem',
  localField: '_id',
  foreignField: 'restaurant'
});

export default mongoose.model('Restaurant', restaurantSchema);