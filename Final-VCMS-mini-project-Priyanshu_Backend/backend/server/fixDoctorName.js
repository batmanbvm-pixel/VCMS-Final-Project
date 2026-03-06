require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function fixDoctorName() {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'naruto1821uzumaki@gmail.com';
  const doctor = await User.findOne({ email });

  if (!doctor) {
    console.log('Doctor not found for:', email);
    await mongoose.connection.close();
    return;
  }

  doctor.name = String(doctor.name || '').replace(/^\s*Dr\.?\s*/i, '').trim() || 'Naruto Uzumaki';
  await doctor.save();

  console.log('Updated name:', doctor.name);
  await mongoose.connection.close();
}

fixDoctorName().catch(async (err) => {
  console.error('fixDoctorName failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
