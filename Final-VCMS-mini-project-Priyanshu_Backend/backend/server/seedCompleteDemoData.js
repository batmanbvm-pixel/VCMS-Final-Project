const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Prescription = require('./models/Prescription');
const MedicalHistory = require('./models/MedicalHistory');
const Notification = require('./models/Notification');
const DoctorReview = require('./models/DoctorReview');

async function seedCompleteData() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log('✅ Connected to MongoDB\n');

    // Get Rudra (Doctor) and Preet (Patient)
    const rudra = await User.findOne({ email: 'rudra12@gmail.com' });
    const preet = await User.findOne({ email: 'preetp2412@gmail.com' });

    if (!rudra || !preet) {
      console.error('❌ Could not find rudra12@gmail.com or preetp2412@gmail.com');
      process.exit(1);
    }

    console.log(`👨‍⚕️ Doctor: ${rudra.name} (${rudra.email})`);
    console.log(`👤 Patient: ${preet.name} (${preet.email})\n`);

    // Clear existing data for these two users
    await Appointment.deleteMany({ 
      $or: [
        { patientId: preet._id, doctorId: rudra._id },
        { patientId: preet._id }
      ]
    });
    await Prescription.deleteMany({ patientId: preet._id });
    await MedicalHistory.deleteMany({ patientId: preet._id });
    await DoctorReview.deleteMany({ patientId: preet._id });
    await Notification.deleteMany({ userId: { $in: [preet._id, rudra._id] } });

    console.log('🗑️  Cleared existing data for Preet\n');

    // ===== MEDICAL HISTORY =====
    console.log('📋 Creating Medical History...');
    
    const medicalHistories = [
      {
        patientId: preet._id,
        patientName: preet.name,
        patientEmail: preet.email,
        condition: 'Hypertension',
        diagnosedDate: new Date('2023-01-15'),
        status: 'ongoing',
        severity: 'moderate',
        treatment: 'Lifestyle changes and medication',
        notes: 'Blood pressure controlled with medication. Regular monitoring required.',
        medications: ['Amlodipine 5mg', 'Lisinopril 10mg'],
        allergies: ['Penicillin'],
        lastUpdated: new Date(),
      },
      {
        patientId: preet._id,
        patientName: preet.name,
        patientEmail: preet.email,
        condition: 'Type 2 Diabetes',
        diagnosedDate: new Date('2022-06-20'),
        status: 'ongoing',
        severity: 'moderate',
        treatment: 'Metformin and diet control',
        notes: 'HbA1c levels improving. Continue current treatment.',
        medications: ['Metformin 500mg'],
        lastUpdated: new Date(),
      },
      {
        patientId: preet._id,
        patientName: preet.name,
        patientEmail: preet.email,
        condition: 'Seasonal Allergies',
        diagnosedDate: new Date('2020-03-10'),
        status: 'ongoing',
        severity: 'mild',
        treatment: 'Antihistamines during allergy season',
        notes: 'Mostly controlled with over-the-counter medications.',
        medications: ['Cetirizine 10mg as needed'],
        lastUpdated: new Date(),
      }
    ];

    await MedicalHistory.insertMany(medicalHistories);
    console.log(`✅ Created ${medicalHistories.length} medical history records\n`);

    // ===== APPOINTMENTS =====
    console.log('📅 Creating Appointments...');

    const appointments = [];
    const now = new Date();

    // Appointment 1 - Completed (3 months ago)
    const appt1Date = new Date(now);
    appt1Date.setMonth(appt1Date.getMonth() - 3);
    appt1Date.setHours(10, 0, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt1Date,
      time: '10:00',
      symptoms: 'High blood pressure, headaches',
      notes: 'First consultation for hypertension management',
      status: 'completed',
      type: 'video',
      roomId: `room-${Date.now()}-1`,
      createdAt: new Date(appt1Date.getTime() - 7 * 24 * 60 * 60 * 1000), // Booked 1 week before
    });

    // Appointment 2 - Completed (2 months ago)
    const appt2Date = new Date(now);
    appt2Date.setMonth(appt2Date.getMonth() - 2);
    appt2Date.setHours(14, 30, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt2Date,
      time: '14:30',
      symptoms: 'Follow-up for diabetes management',
      notes: 'Blood sugar levels need monitoring',
      status: 'completed',
      type: 'in-person',
      createdAt: new Date(appt2Date.getTime() - 5 * 24 * 60 * 60 * 1000),
    });

    // Appointment 3 - Completed (1 month ago)
    const appt3Date = new Date(now);
    appt3Date.setMonth(appt3Date.getMonth() - 1);
    appt3Date.setHours(11, 0, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt3Date,
      time: '11:00',
      symptoms: 'Chest pain, breathing difficulty',
      notes: 'Patient experienced chest discomfort. ECG recommended.',
      status: 'completed',
      type: 'video',
      roomId: `room-${Date.now()}-3`,
      createdAt: new Date(appt3Date.getTime() - 3 * 24 * 60 * 60 * 1000),
    });

    // Appointment 4 - Completed (2 weeks ago)
    const appt4Date = new Date(now);
    appt4Date.setDate(appt4Date.getDate() - 14);
    appt4Date.setHours(15, 0, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt4Date,
      time: '15:00',
      symptoms: 'Fever, cough, fatigue',
      notes: 'Possible viral infection. Prescribed rest and medications.',
      status: 'completed',
      type: 'video',
      roomId: `room-${Date.now()}-4`,
      createdAt: new Date(appt4Date.getTime() - 2 * 24 * 60 * 60 * 1000),
    });

    // Appointment 5 - Upcoming (tomorrow)
    const appt5Date = new Date(now);
    appt5Date.setDate(appt5Date.getDate() + 1);
    appt5Date.setHours(10, 30, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt5Date,
      time: '10:30',
      symptoms: 'Routine checkup',
      notes: 'Regular health checkup and medication review',
      status: 'confirmed',
      type: 'video',
      roomId: `room-${Date.now()}-5`,
      createdAt: new Date(),
    });

    // Appointment 6 - Upcoming (next week)
    const appt6Date = new Date(now);
    appt6Date.setDate(appt6Date.getDate() + 7);
    appt6Date.setHours(14, 0, 0, 0);
    appointments.push({
      patientId: preet._id,
      doctorId: rudra._id,
      date: appt6Date,
      time: '14:00',
      symptoms: 'Follow-up consultation',
      notes: 'Review test results and adjust treatment',
      status: 'confirmed',
      type: 'in-person',
      createdAt: new Date(),
    });

    const createdAppointments = await Appointment.insertMany(appointments);
    console.log(`✅ Created ${createdAppointments.length} appointments\n`);

    // ===== PRESCRIPTIONS =====
    console.log('💊 Creating Prescriptions...');

    const prescriptions = [
      {
        appointmentId: createdAppointments[0]._id,
        patientId: preet._id,
        doctorId: rudra._id,
        diagnosis: 'Essential Hypertension',
        medications: [
          {
            name: 'Amlodipine',
            dosage: '5mg',
            frequency: 'Once daily',
            duration: '30 days',
            instructions: 'Take in the morning with food',
          },
          {
            name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '30 days',
            instructions: 'Take at bedtime',
          }
        ],
        clinicalNotes: 'Monitor blood pressure daily. Avoid high sodium foods. Regular exercise recommended.',
        followUpDate: new Date(appt1Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        status: 'issued',
        issuedAt: createdAppointments[0].createdAt,
        validFrom: createdAppointments[0].createdAt,
        validUntil: new Date(appt1Date.getTime() + 90 * 24 * 60 * 60 * 1000),
        createdAt: createdAppointments[0].createdAt,
      },
      {
        appointmentId: createdAppointments[1]._id,
        patientId: preet._id,
        doctorId: rudra._id,
        diagnosis: 'Type 2 Diabetes Mellitus',
        medications: [
          {
            name: 'Metformin',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '60 days',
            instructions: 'Take after meals',
          },
          {
            name: 'Glimepiride',
            dosage: '2mg',
            frequency: 'Once daily',
            duration: '60 days',
            instructions: 'Take before breakfast',
          }
        ],
        clinicalNotes: 'Follow diabetic diet plan. Check blood sugar levels regularly. Exercise 30 mins daily.',
        followUpDate: new Date(appt2Date.getTime() + 60 * 24 * 60 * 60 * 1000),
        status: 'issued',
        issuedAt: createdAppointments[1].createdAt,
        validFrom: createdAppointments[1].createdAt,
        validUntil: new Date(appt2Date.getTime() + 90 * 24 * 60 * 60 * 1000),
        createdAt: createdAppointments[1].createdAt,
      },
      {
        appointmentId: createdAppointments[2]._id,
        patientId: preet._id,
        doctorId: rudra._id,
        diagnosis: 'Acute Bronchitis',
        medications: [
          {
            name: 'Azithromycin',
            dosage: '500mg',
            frequency: 'Once daily',
            duration: '5 days',
            instructions: 'Take on empty stomach',
          },
          {
            name: 'Dextromethorphan',
            dosage: '10mg',
            frequency: 'Three times daily',
            duration: '7 days',
            instructions: 'Take after meals for cough relief',
          },
          {
            name: 'Paracetamol',
            dosage: '500mg',
            frequency: 'As needed (max 4 times daily)',
            duration: '7 days',
            instructions: 'Take for fever or pain',
          }
        ],
        clinicalNotes: 'Rest adequately. Drink plenty of fluids. Avoid cold drinks. Return if symptoms worsen.',
        followUpDate: new Date(appt3Date.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: 'picked_up',
        issuedAt: createdAppointments[2].createdAt,
        pickedUpAt: new Date(appt3Date.getTime() + 1 * 24 * 60 * 60 * 1000),
        validFrom: createdAppointments[2].createdAt,
        validUntil: new Date(appt3Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: createdAppointments[2].createdAt,
      },
      {
        appointmentId: createdAppointments[3]._id,
        patientId: preet._id,
        doctorId: rudra._id,
        diagnosis: 'Viral Fever with Upper Respiratory Tract Infection',
        medications: [
          {
            name: 'Paracetamol',
            dosage: '650mg',
            frequency: 'Three times daily',
            duration: '5 days',
            instructions: 'Take after meals',
          },
          {
            name: 'Cetirizine',
            dosage: '10mg',
            frequency: 'Once daily at bedtime',
            duration: '5 days',
            instructions: 'May cause drowsiness',
          },
          {
            name: 'Vitamin C',
            dosage: '500mg',
            frequency: 'Once daily',
            duration: '10 days',
            instructions: 'Take with water',
          }
        ],
        clinicalNotes: 'Complete rest for 3-4 days. Steam inhalation twice daily. Warm water gargles. Avoid cold foods.',
        followUpDate: new Date(appt4Date.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: 'issued',
        issuedAt: createdAppointments[3].createdAt,
        viewedAt: new Date(appt4Date.getTime() + 2 * 60 * 60 * 1000),
        validFrom: createdAppointments[3].createdAt,
        validUntil: new Date(appt4Date.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: createdAppointments[3].createdAt,
      }
    ];

    await Prescription.insertMany(prescriptions);
    console.log(`✅ Created ${prescriptions.length} prescriptions\n`);

    // ===== DOCTOR REVIEWS =====
    console.log('⭐ Creating Doctor Reviews...');

    const reviews = [
      {
        doctorId: rudra._id,
        doctorName: rudra.name,
        patientId: preet._id,
        patientName: preet.name,
        appointmentId: createdAppointments[0]._id,
        rating: 5,
        review: 'Excellent doctor! Very thorough in examination and explained everything clearly. Highly recommended.',
        createdAt: new Date(appt1Date.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        doctorId: rudra._id,
        doctorName: rudra.name,
        patientId: preet._id,
        patientName: preet.name,
        appointmentId: createdAppointments[1]._id,
        rating: 5,
        review: 'Very knowledgeable and patient. Takes time to listen to concerns. Great experience!',
        createdAt: new Date(appt2Date.getTime() + 1 * 24 * 60 * 60 * 1000),
      },
      {
        doctorId: rudra._id,
        doctorName: rudra.name,
        patientId: preet._id,
        patientName: preet.name,
        appointmentId: createdAppointments[2]._id,
        rating: 4,
        review: 'Good consultation. Doctor was helpful and the treatment worked well.',
        createdAt: new Date(appt3Date.getTime() + 3 * 24 * 60 * 60 * 1000),
      }
    ];

    await DoctorReview.insertMany(reviews);
    console.log(`✅ Created ${reviews.length} doctor reviews\n`);

    // Update doctor's average rating
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await User.findByIdAndUpdate(rudra._id, {
      $set: { 
        rating: avgRating,
        reviewCount: reviews.length 
      }
    });
    console.log(`✅ Updated Dr. Rudra's rating: ${avgRating.toFixed(1)} (${reviews.length} reviews)\n`);

    // ===== NOTIFICATIONS =====
    console.log('🔔 Creating Notifications...');

    const notifications = [
      {
        userId: preet._id,
        type: 'appointment',
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${rudra.name} on ${appt5Date.toDateString()} at 10:30 AM is confirmed.`,
        isRead: false,
        createdAt: new Date(),
      },
      {
        userId: preet._id,
        type: 'appointment',
        title: 'Upcoming Appointment Reminder',
        message: `Reminder: You have an appointment with Dr. ${rudra.name} tomorrow at 10:30 AM.`,
        isRead: false,
        createdAt: new Date(),
      },
      {
        userId: preet._id,
        type: 'prescription',
        title: 'New Prescription Available',
        message: `Dr. ${rudra.name} has issued a new prescription for you. Please review it.`,
        isRead: true,
        readAt: new Date(appt4Date.getTime() + 2 * 60 * 60 * 1000),
        createdAt: new Date(appt4Date.getTime() + 1 * 60 * 60 * 1000),
      },
      {
        userId: rudra._id,
        type: 'appointment',
        title: 'New Appointment Booked',
        message: `${preet.name} has booked an appointment with you for ${appt5Date.toDateString()} at 10:30 AM.`,
        isRead: false,
        createdAt: new Date(),
      },
      {
        userId: rudra._id,
        type: 'system',
        title: 'New Review Received',
        message: `${preet.name} has left a 5-star review for you!`,
        isRead: false,
        createdAt: new Date(appt1Date.getTime() + 2 * 24 * 60 * 60 * 1000),
      }
    ];

    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} notifications\n`);

    // ===== SUMMARY =====
    console.log('═══════════════════════════════════════════════════');
    console.log('🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('📊 SUMMARY:');
    console.log(`   └─ Medical History Records: ${medicalHistories.length}`);
    console.log(`   └─ Appointments Created: ${createdAppointments.length}`);
    console.log(`   │  ├─ Completed: ${appointments.filter(a => a.status === 'completed').length}`);
    console.log(`   │  └─ Upcoming: ${appointments.filter(a => a.status === 'confirmed').length}`);
    console.log(`   └─ Prescriptions: ${prescriptions.length}`);
    console.log(`   └─ Doctor Reviews: ${reviews.length}`);
    console.log(`   └─ Notifications: ${notifications.length}\n`);

    console.log('👥 TEST ACCOUNTS:');
    console.log(`   Patient: ${preet.email}`);
    console.log(`   Doctor:  ${rudra.email}\n`);

    console.log('✅ Database is now consistent and ready for testing!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedCompleteData();
