import 'dotenv/config';
import { connectDB } from '../config/db.js';
import Restaurant from '../models/Restaurant.js';
import MenuItem from '../models/MenuItem.js';

await connectDB();
await Restaurant.deleteMany({}); await MenuItem.deleteMany({});
const restaurants = await Restaurant.insertMany([
 {name:'Spice Route',cuisine:['North Indian','Biryani'],rating:4.5,deliveryTime:28,location:'Downtown',priceForTwo:450,image:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80'},
 {name:'Pizza Lab',cuisine:['Pizza','Italian'],rating:4.3,deliveryTime:32,location:'Central Market',priceForTwo:550,image:'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'},
 {name:'Green Bowl',cuisine:['Healthy','Salads'],rating:4.6,deliveryTime:22,location:'Tech Park',priceForTwo:400,image:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'}
]);
await MenuItem.insertMany([
 {restaurant:restaurants[0]._id,name:'Paneer Butter Masala',description:'Creamy tomato gravy with soft paneer.',price:240,isVeg:true,category:'Main Course'},
 {restaurant:restaurants[0]._id,name:'Chicken Biryani',description:'Aromatic basmati rice and spiced chicken.',price:290,isVeg:false,category:'Biryani'},
 {restaurant:restaurants[1]._id,name:'Margherita Pizza',description:'Tomato, mozzarella and basil.',price:299,isVeg:true,category:'Pizza'},
 {restaurant:restaurants[1]._id,name:'Farmhouse Pizza',description:'Loaded with fresh vegetables.',price:399,isVeg:true,category:'Pizza'},
 {restaurant:restaurants[2]._id,name:'Protein Bowl',description:'Greens, grains, veggies and protein.',price:349,isVeg:true,category:'Bowls'},
 {restaurant:restaurants[2]._id,name:'Avocado Salad',description:'Fresh avocado, greens and seeds.',price:329,isVeg:true,category:'Salads'}
]);
console.log('Seed complete'); process.exit(0);
