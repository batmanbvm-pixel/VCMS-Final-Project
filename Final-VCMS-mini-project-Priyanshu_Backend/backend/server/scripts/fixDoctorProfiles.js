const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vcms';

/**
 * Fix all doctor profiles in the database:
 * 1. Set approvalStatus to "approved" for all doctors
 * 2. Set onlineStatus to "online" for all doctors
 * 3. Calculate and set isApprovedAndComplete based on profile completeness
 */
async function fixDoctorProfiles() {
  try {
    await mongoose.connect(mongoURI);

    // Find all doctors
    const doctors = await User.find({ role: 'doctor' });

    let updated = 0;
    let alreadyComplete = 0;

    for (const doctor of doctors) {
      const changes = [];
      let needsUpdate = false;

      // Check if profile is complete
      const hasName = !!(doctor.name || doctor.displayName);
      const hasEmail = !!doctor.email && !doctor.email.startsWith('placeholder_');
      const hasPhone = !!doctor.phone;
      const hasSpecialization = !!doctor.specialization;
      const hasExperience = typeof doctor.experience === 'number' && doctor.experience >= 0;
      const hasConsultationFee = typeof doctor.consultationFee === 'number' && doctor.consultationFee >= 0;
      const hasLocation = !!(doctor.location || doctor.city);
      const hasQualifications = Array.isArray(doctor.qualifications) && doctor.qualifications.length > 0;

      const isComplete = hasName && hasEmail && hasPhone && hasSpecialization && 
                        hasExperience && hasConsultationFee && hasLocation;

      // Update approvalStatus if not already approved
      if (doctor.approvalStatus !== 'approved') {
        doctor.approvalStatus = 'approved';
        doctor.approvedAt = new Date();
        changes.push('✓ Approved');
        needsUpdate = true;
      }

      // Update onlineStatus to online
      if (doctor.onlineStatus !== 'online') {
        doctor.onlineStatus = 'online';
        changes.push('✓ Set online');
        needsUpdate = true;
      }

      // Set isApprovedAndComplete based on profile completeness
      if (isComplete && !doctor.isApprovedAndComplete) {
        doctor.isApprovedAndComplete = true;
        changes.push('✓ Marked complete profile');
        needsUpdate = true;
      } else if (!isComplete && doctor.isApprovedAndComplete) {
        doctor.isApprovedAndComplete = false;
        changes.push('⚠️  Marked incomplete (missing fields)');
        needsUpdate = true;
      }

      // Calculate profile completion percentage
      const fields = [hasName, hasEmail, hasPhone, hasSpecialization, hasExperience, 
                     hasConsultationFee, hasLocation, hasQualifications];
      const completionPercentage = Math.round((fields.filter(Boolean).length / fields.length) * 100);
      
      if (doctor.profileCompletionPercentage !== completionPercentage) {
        doctor.profileCompletionPercentage = completionPercentage;
        changes.push(`📊 ${completionPercentage}% complete`);
        needsUpdate = true;
      }

      // Ensure isActive is true
      if (doctor.isActive === false) {
        doctor.isActive = true;
        changes.push('✓ Activated');
        needsUpdate = true;
      }

      if (needsUpdate) {
        await doctor.save();
        updated++;
        
        if (!isComplete) {
          const missing = [];
          if (!hasName) missing.push('name');
          if (!hasEmail) missing.push('email');
          if (!hasPhone) missing.push('phone');
          if (!hasSpecialization) missing.push('specialization');
          if (!hasExperience) missing.push('experience');
          if (!hasConsultationFee) missing.push('consultationFee');
          if (!hasLocation) missing.push('location');
          if (!hasQualifications) missing.push('qualifications');
        }
      } else {
        alreadyComplete++;
      }
    }

    // Summary of doctors by status
    const onlineDoctors = await User.countDocuments({ role: 'doctor', onlineStatus: 'online' });
    const completeDoctors = await User.countDocuments({ role: 'doctor', isApprovedAndComplete: true });
    const approvedDoctors = await User.countDocuments({ role: 'doctor', approvalStatus: 'approved' });

    void updated;
    void alreadyComplete;
    void onlineDoctors;
    void completeDoctors;
    void approvedDoctors;

  } catch (error) {
    void error;
  } finally {
    await mongoose.connection.close();
  }
}

// Run the script
fixDoctorProfiles();
