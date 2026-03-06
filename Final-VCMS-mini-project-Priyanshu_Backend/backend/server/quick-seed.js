#!/usr/bin/env node
/**
 * Quick Seeder Script - Creates demo accounts for testing
 * Run: node quick-seed.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

const MONGODB_URI = process.env.MONGO_URI;

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Hash password
    const hashedPassword = await bcrypt.hash('Test@1234', 10);

    // Demo accounts
    const demoAccounts = [
      {
        name: 'Admin User',
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: 'admin',
        phone: '1234567890',
        approvalStatus: 'approved',
        isActive: true,
        specialization: 'System Administrator',
      },
      {
        name: 'Dr. Alice Johnson',
        email: 'alice@gmail.com',
        password: hashedPassword,
        role: 'doctor',
        phone: '9876543210',
        approvalStatus: 'approved',
        isActive: true,
        specialization: 'General Medicine',
        consultationFee: 500,
        experience: 10,
      },
      {
        name: 'John Doe',
        email: 'john@gmail.com',
        password: hashedPassword,
        role: 'patient',
        phone: '9123456789',
        approvalStatus: 'approved',
        isActive: true,
        age: 30,
        gender: 'male',
      },
    ];

    // Delete existing demo accounts
    await User.deleteMany({
      email: { $in: ['admin@gmail.com', 'alice@gmail.com', 'john@gmail.com'] }
    });
    console.log('🗑️  Cleared old demo accounts');

    // Create new accounts
    const createdUsers = [];
    for (const account of demoAccounts) {
      const user = await User.create(account);
      createdUsers.push(user);
      console.log(`✅ Created ${account.role}: ${account.email}`);
    }

    console.log('\n✨ Database seeding complete!');
    console.log('\n📋 Demo Accounts Created:');
    console.log('  Admin:  admin@gmail.com / Test@1234');
    console.log('  Doctor: alice@gmail.com / Test@1234');
    console.log('  Patient: john@gmail.com / Test@1234');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seedDatabase();
