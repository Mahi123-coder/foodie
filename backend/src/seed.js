import 'dotenv/config';

import { connectDB } from './config/db.js';
import Restaurant from './models/Restaurant.js';
import MenuItem from './models/MenuItem.js';

const restaurants = [
  {
    name: 'Cafe 1947',
    cuisine: ['Indian', 'Chinese'],
    rating: 4.5,
    deliveryTime: 20,
    image:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    location: 'Jaipur',
    latitude: 26.8530,
    longitude: 75.8046,
    priceForTwo: 800,
    isVeg: false
  },
  {
    name: 'Bellagio',
    cuisine: ['European'],
    rating: 5.0,
    deliveryTime: 25,
    image:
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    location: 'Gurugram',
    latitude: 28.4595,
    longitude: 77.0266,
    priceForTwo: 1650,
    isVeg: false
  },
  {
    name: 'Greenr Cafe',
    cuisine: ['American', 'European'],
    rating: 4.9,
    deliveryTime: 25,
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    location: 'Delhi',
    latitude: 28.5246,
    longitude: 77.2066,
    priceForTwo: 2500,
    isVeg: true
  },
  {
    name: 'Spice Route',
    cuisine: ['Indian', 'North Indian'],
    rating: 4.5,
    deliveryTime: 30,
    image:
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80',
    location: 'Bangalore',
    latitude: 12.9716,
    longitude: 77.5946,
    priceForTwo: 500,
    isVeg: true
  },
  {
    name: 'Pizza Paradise',
    cuisine: ['Italian', 'Pizza'],
    rating: 4.3,
    deliveryTime: 25,
    image:
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    location: 'Bangalore',
    latitude: 12.9352,
    longitude: 77.6245,
    priceForTwo: 600,
    isVeg: false
  }
];

const menuData = [
  {
    name: 'Paneer Butter Masala',
    description: 'Creamy tomato gravy with soft paneer',
    price: 220,
    category: 'Main Course',
    image:
      'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=800&q=80',
    isVeg: true
  },
  {
    name: 'Butter Naan',
    description: 'Soft naan brushed with butter',
    price: 60,
    category: 'Breads',
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80',
    isVeg: true
  },
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato, mozzarella and basil',
    price: 299,
    category: 'Pizza',
    image:
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80',
    isVeg: true
  }
];

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    await connectDB();
    console.log('✅ MongoDB connected');

    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    console.log('🗑️ Old restaurants and menu items removed');

    const createdRestaurants = await Restaurant.insertMany(restaurants);
    console.log(`🍴 ${createdRestaurants.length} restaurants created`);

    const menuItems = [
      { ...menuData[0], restaurant: createdRestaurants[0]._id },
      { ...menuData[1], restaurant: createdRestaurants[0]._id },
      { ...menuData[2], restaurant: createdRestaurants[1]._id }
    ];

    await MenuItem.insertMany(menuItems);
    console.log(`🍽️ ${menuItems.length} menu items created`);

    console.log('🗺️ Restaurant coordinates added successfully!');
    console.log('✅ Seed completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seed();