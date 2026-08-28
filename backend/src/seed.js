import 'dotenv/config';
import mongoose from 'mongoose';

import Restaurant from './models/Restaurant.js';
import MenuItem from './models/MenuItem.js';

const restaurants = [
  {
    name: 'Spice Route',
    cuisine: ['Indian', 'North Indian'],
    rating: 4.5,
    deliveryTime: 30,
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe',
    location: 'Bangalore',
    priceForTwo: 500,
    isVeg: true
  },
  {
    name: 'Pizza Paradise',
    cuisine: ['Italian', 'Pizza'],
    rating: 4.3,
    deliveryTime: 25,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002',
    location: 'Bangalore',
    priceForTwo: 600,
    isVeg: false
  },
  {
    name: 'Burger House',
    cuisine: ['Burgers', 'Fast Food'],
    rating: 4.4,
    deliveryTime: 20,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
    location: 'Bangalore',
    priceForTwo: 400,
    isVeg: false
  },
  {
    name: 'Dosa Corner',
    cuisine: ['South Indian', 'Breakfast'],
    rating: 4.6,
    deliveryTime: 20,
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976',
    location: 'Bangalore',
    priceForTwo: 300,
    isVeg: true
  },
  {
    name: 'Wok Express',
    cuisine: ['Chinese', 'Asian'],
    rating: 4.2,
    deliveryTime: 35,
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19',
    location: 'Bangalore',
    priceForTwo: 550,
    isVeg: false
  }
];

const menuData = [
  {
    name: 'Paneer Butter Masala',
    description: 'Creamy tomato gravy with soft paneer',
    price: 220,
    category: 'Main Course',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7',
    isVeg: true
  },
  {
    name: 'Butter Naan',
    description: 'Soft naan brushed with butter',
    price: 60,
    category: 'Breads',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950',
    isVeg: true
  },
  {
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato, mozzarella and basil',
    price: 299,
    category: 'Pizza',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002',
    isVeg: true
  },
  {
    name: 'Chicken Burger',
    description: 'Crispy chicken patty with fresh vegetables',
    price: 249,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
    isVeg: false
  },
  {
    name: 'Masala Dosa',
    description: 'Crispy dosa served with potato masala',
    price: 120,
    category: 'South Indian',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976',
    isVeg: true
  },
  {
    name: 'Veg Hakka Noodles',
    description: 'Stir-fried noodles with fresh vegetables',
    price: 180,
    category: 'Chinese',
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19',
    isVeg: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('MongoDB connected');

    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});

    const createdRestaurants = await Restaurant.insertMany(restaurants);

    const menuItems = [
      {
        ...menuData[0],
        restaurant: createdRestaurants[0]._id
      },
      {
        ...menuData[1],
        restaurant: createdRestaurants[0]._id
      },
      {
        ...menuData[2],
        restaurant: createdRestaurants[1]._id
      },
      {
        ...menuData[3],
        restaurant: createdRestaurants[2]._id
      },
      {
        ...menuData[4],
        restaurant: createdRestaurants[3]._id
      },
      {
        ...menuData[5],
        restaurant: createdRestaurants[4]._id
      }
    ];

    await MenuItem.insertMany(menuItems);

    console.log('✅ Restaurants and menu items added successfully!');
    console.log(`🍴 Restaurants: ${createdRestaurants.length}`);
    console.log(`🍽️ Menu items: ${menuItems.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();