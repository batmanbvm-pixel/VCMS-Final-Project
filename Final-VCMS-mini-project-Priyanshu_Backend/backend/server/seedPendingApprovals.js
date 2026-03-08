const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const User = require('./models/User');
const Appointment = require('./models/Appointment');

const seedPendingApprovals = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in .env');
    }
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Create pending doctor users
    const pendingDoctors = [
      {
        name: 'Amit Patel',
        email: 'amit.patel@gmail.com',
        password: 'Password@123',
        role: 'doctor',
        phone: '+919876543210',
        specialization: 'Cardiology',
        qualifications: ['MBBS', 'DM Cardiology'],
        experience: 8,
        approvalStatus: 'pending',
        isApproved: false,
        isActive: true,
      },
      {
        name: 'Neha Sharma',
        email: 'neha.sharma@gmail.com',
        password: 'Password@123',
        role: 'doctor',
        phone: '+919876543211',
        specialization: 'Gynecology',
        qualifications: ['MBBS', 'MD Gynecology'],
        experience: 6,
        approvalStatus: 'pending',
        isApproved: false,
        isActive: true,
      },
      {
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@gmail.com',
        password: 'Password@123',
        role: 'doctor',
        phone: '+919876543212',
        specialization: 'Orthopedics',
        qualifications: ['MBBS', 'MS Orthopedics'],
        experience: 10,
        approvalStatus: 'pending',
        isApproved: false,
        isActive: true,
      },
    ];

    // Create pending patient users
    const pendingPatients = [
      {
        name: 'Aisha Khan',
        email: 'aisha.khan@gmail.com',
        password: 'Password@123',
        role: 'patient',
        phone: '+919876543213',
        approvalStatus: 'pending',
        isApproved: false,
        isActive: true,
      },
      {
        name: 'Vikram Singh',
        email: 'vikram.singh@gmail.com',
        password: 'Password@123',
        role: 'patient',
        phone: '+919876543214',
        approvalStatus: 'pending',
        isApproved: false,
        isActive: true,
      },
    ];

    // Check existing pending users
    const existingDoctorEmails = await User.find({
      email: { $in: pendingDoctors.map(d => d.email) },
    }).select('email');

    const existingPatientEmails = await User.find({
      email: { $in: pendingPatients.map(p => p.email) },
    }).select('email');

    const existingDoctorEmailSet = new Set(existingDoctorEmails.map(u => u.email));
    const existingPatientEmailSet = new Set(existingPatientEmails.map(u => u.email));

    // Insert only new doctors
    const doctorsToInsert = pendingDoctors.filter(d => !existingDoctorEmailSet.has(d.email));
    if (doctorsToInsert.length > 0) {
      const insertedDoctors = await User.insertMany(doctorsToInsert);
      console.log(`✅ Created ${insertedDoctors.length} pending doctors`);
    } else {
      console.log('ℹ️ All pending doctors already exist');
    }

    // Insert only new patients
    const patientsToInsert = pendingPatients.filter(p => !existingPatientEmailSet.has(p.email));
    if (patientsToInsert.length > 0) {
      const insertedPatients = await User.insertMany(patientsToInsert);
      console.log(`✅ Created ${insertedPatients.length} pending patients`);
    } else {
      console.log('ℹ️ All pending patients already exist');
    }

    console.log('✅ Pending approvals seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedPendingApprovals();
