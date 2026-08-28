import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisine: [String],
  rating: { type: Number, default: 4.0 },
  deliveryTime: { type: Number, default: 30 },
  image: String,
  location: String,
  priceForTwo: Number,
  isVeg: { type: Boolean, default: false }
});

export default mongoose.model('Restaurant', restaurantSchema);
