require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const { updateProfileCompletion } = require('./utils/profileCompletion');

const TARGET_EMAIL = 'naruto1821uzumaki@gmail.com';
const TARGET_PASSWORD = 'Preet@2412';

async function createOrUpdateDoctor() {
  await mongoose.connect(process.env.MONGO_URI);

  const passwordHash = await bcrypt.hash(TARGET_PASSWORD, 10);

  const doctorData = {
    name: 'Naruto Uzumaki',
    email: TARGET_EMAIL,
    username: 'naruto1821uzumaki',
    password: passwordHash,
    role: 'doctor',
    phone: '9876543211',
    specialization: 'General Medicine',
    experience: 8,
    consultationFee: 800,
    location: 'Ahmedabad, Gujarat',
    city: 'Ahmedabad',
    state: 'Gujarat',
    bio: 'Dedicated General Medicine doctor focused on accurate diagnosis, practical treatment plans, and patient-first communication.',
    qualifications: ['MBBS', 'MD (Internal Medicine)'],
    languages: ['English', 'Hindi', 'Gujarati'],
    availability: [
      { day: 'Monday', startTime: '09:00', endTime: '17:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'Friday', startTime: '09:00', endTime: '17:00' }
    ],
    symptoms: [
      'Fever',
      'Cough',
      'Headache',
      'Chest Pain',
      'Breathing Difficulty',
      'Stomach Pain',
      'Skin Rash',
      'Joint Pain',
      'Back Pain',
      'Anxiety/Stress'
    ],
    expertise_symptoms: [
      'Fever',
      'Cough',
      'Headache',
      'Chest Pain',
      'Breathing Difficulty',
      'Stomach Pain',
      'Skin Rash',
      'Joint Pain',
      'Back Pain',
      'Anxiety/Stress'
    ],
    approvalStatus: 'approved',
    accountStatus: 'active',
    isActive: true,
    isPublic: true,
    available: true,
    onlineStatus: 'offline'
  };

  const existing = await User.findOne({ email: TARGET_EMAIL });

  let doctor;
  if (existing) {
    Object.assign(existing, doctorData);
    updateProfileCompletion(existing);
    doctor = await existing.save();
    console.log('Doctor updated:', doctor.email);
  } else {
    doctor = new User(doctorData);
    updateProfileCompletion(doctor);
    doctor = await doctor.save();
    console.log('Doctor created:', doctor.email);
  }

  console.log({
    name: doctor.name,
    email: doctor.email,
    role: doctor.role,
    approvalStatus: doctor.approvalStatus,
    profileCompletionPercentage: doctor.profileCompletionPercentage,
    isApprovedAndComplete: doctor.isApprovedAndComplete
  });

  await mongoose.connection.close();
}

createOrUpdateDoctor().catch(async (err) => {
  console.error('createDoctor failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
