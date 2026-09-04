import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
dotenv.config({ path: './backend/.env' });

import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant.js';

async function updateMissingCoordinates() {
  try {
    console.log('⏳ Connecting to Database...');
    
    // Checks MONGO_URI, MONGODB_URI, or falls back to your process env
    const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!dbUri) {
      throw new Error("MongoDB URI is missing from .env file. Please check your variable name (MONGO_URI or MONGODB_URI).");
    }

    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB Atlas');

    await Restaurant.updateOne(
      { name: 'Bellagio' },
      { $set: { latitude: 28.4595, longitude: 77.0266, location: 'Gurugram' } }
    );

    await Restaurant.updateOne(
      { name: 'Greenr Cafe' },
      { $set: { latitude: 28.5246, longitude: 77.2066, location: 'Saket, New Delhi' } }
    );

    await Restaurant.updateOne(
      { name: 'Cafe 1947' },
      { $set: { latitude: 26.8530, longitude: 75.8046, location: 'Jaipur' } }
    );

    console.log('✅ Updated coordinates for Bellagio, Greenr Cafe, and Cafe 1947');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update coordinates:', error.message);
    process.exit(1);
  }
}

updateMissingCoordinates();