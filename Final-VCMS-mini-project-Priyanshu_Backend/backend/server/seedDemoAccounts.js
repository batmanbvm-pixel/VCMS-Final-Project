const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  phone: String,
  dateOfBirth: Date,
  gender: String,
  address: String,
  isApproved: { type: Boolean, default: false },
  specialization: String,
  experience: Number,
  consultationFee: Number,
  qualifications: [String],
  languagesSpoken: [String],
  availableTimeSlots: [{
    day: String,
    startTime: String,
    endTime: String
  }],
  expertise_symptoms: [String],
  bio: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

const demoAccounts = [
  {
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: '12345',
    role: 'admin',
    phone: '+919999999999',
    isApproved: true
  },
  {
    name: 'Dr. Alice Johnson',
    email: 'alice@gmail.com',
    password: 'Test@1234',
    role: 'doctor',
    phone: '+919876543210',
    isApproved: true,
    specialization: 'General Physician',
    experience: 10,
    consultationFee: 500,
    qualifications: ['MBBS', 'MD Internal Medicine'],
    languagesSpoken: ['English', 'Hindi'],
    expertise_symptoms: ['Fever', 'Cough', 'Headache', 'Stomach Pain'],
    bio: 'Experienced general physician with 10 years of practice. Specialized in treating common ailments and preventive care.'
  },
  {
    name: 'Dr. Rudra Patel',
    email: 'rudra12@gmail.com',
    password: 'Preet@2412',
    role: 'doctor',
    phone: '+919876543211',
    isApproved: true,
    specialization: 'Cardiologist',
    experience: 8,
    consultationFee: 800,
    qualifications: ['MBBS', 'MD Cardiology', 'DM Cardiology'],
    languagesSpoken: ['English', 'Hindi', 'Gujarati'],
    expertise_symptoms: ['Chest Pain', 'Breathing Difficulty', 'High Blood Pressure', 'Heart Problems'],
    bio: 'Board-certified cardiologist with expertise in preventive cardiology and management of cardiovascular diseases.'
  },
  {
    name: 'Dr. Naruto Uzumaki',
    email: 'naruto1821uzumaki@gmail.com',
    password: 'Preet@2412',
    role: 'doctor',
    phone: '+919876543212',
    isApproved: true,
    specialization: 'Pediatrician',
    experience: 12,
    consultationFee: 600,
    qualifications: ['MBBS', 'MD Pediatrics'],
    languagesSpoken: ['English', 'Hindi'],
    expertise_symptoms: ['Fever', 'Cough', 'Diarrhea', 'Skin Rash', 'Growth Issues'],
    bio: 'Dedicated pediatrician with 12 years of experience in child healthcare. Passionate about preventive care and child development.'
  },
  {
    name: 'John Doe',
    email: 'john@gmail.com',
    password: 'Test@1234',
    role: 'patient',
    phone: '+919876543220',
    isApproved: true,
    dateOfBirth: new Date('1990-01-15'),
    gender: 'Male',
    address: '123 Main Street, New York, NY 10001'
  },
  {
    name: 'Preet Patel',
    email: 'preetp2412@gmail.com',
    password: 'Preet@2412',
    role: 'patient',
    phone: '+919876543221',
    isApproved: true,
    dateOfBirth: new Date('1995-12-24'),
    gender: 'Male',
    address: '456 Oak Avenue, Mumbai, Maharashtra 400001'
  },
  {
    name: 'Preet Kumar',
    email: 'preet12@gmail.com',
    password: 'Preet@2412',
    role: 'patient',
    phone: '+919876543222',
    isApproved: true,
    dateOfBirth: new Date('1992-06-15'),
    gender: 'Male',
    address: '789 Pine Road, Delhi, Delhi 110001'
  }
];

async function seedAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const account of demoAccounts) {
      const existingUser = await User.findOne({ email: account.email });
      
      if (existingUser) {
        console.log(`⏭️  User ${account.email} already exists, skipping...`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(account.password, 10);
      
      await User.create({
        ...account,
        password: hashedPassword
      });

      console.log(`✅ Created ${account.role}: ${account.email}`);
    }

    console.log('\n🎉 Demo accounts seeding completed!');
    console.log('\n📋 Demo Credentials:');
    console.log('Admin: admin@gmail.com / 12345');
    console.log('Doctors:');
    console.log('  - alice@gmail.com / Test@1234');
    console.log('  - rudra12@gmail.com / Preet@2412');
    console.log('  - naruto1821uzumaki@gmail.com / Preet@2412');
    console.log('Patients:');
    console.log('  - john@gmail.com / Test@1234');
    console.log('  - preetp2412@gmail.com / Preet@2412');
    console.log('  - preet12@gmail.com / Preet@2412');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding demo accounts:', error);
    process.exit(1);
  }
}

seedAccounts();
