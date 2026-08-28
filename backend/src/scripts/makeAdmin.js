import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const email = 'agraniabha2@gmail.com';

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = await User.findOne({ email });

    if (!user) {
      console.log('User not found:', email);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();

    console.log(`SUCCESS: ${user.email} is now an admin.`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

makeAdmin();