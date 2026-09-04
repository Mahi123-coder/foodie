import 'dotenv/config';
import { connectDB } from '../src/config/db.js';
import Restaurant from '../src/models/Restaurant.js';

async function updateMissingCoordinates() {
  try {
    console.log('⏳ Connecting to Database...');
    await connectDB();

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