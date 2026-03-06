/**
 * Fix Dr. Rudra P's location data
 * Run once: node scripts/fixRudraLocation.js
 */

const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

const fix = async () => {
  try {
    await connectDB();

    const doctor = await User.findOne({ name: /rudra/i, role: 'doctor' });
    
    if (!doctor) {
      process.exit(1);
    }

    // Update to correct values
    doctor.city = 'Vadodara';
    doctor.state = 'Gujarat';
    await doctor.save();
    
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
};

fix();
