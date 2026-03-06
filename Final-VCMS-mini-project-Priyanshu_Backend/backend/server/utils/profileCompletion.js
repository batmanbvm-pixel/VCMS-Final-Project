/**
 * Profile Completion Utility
 * Calculates doctor profile completion percentage and determines if doc can go online
 */

// Required fields for 100% doctor profile
const REQUIRED_FIELDS = [
  'name',
  'email',
  'phone',
  'specialization',
  'consultationFee',
  'location',
  'bio',
  'qualifications',
  'languages',
  'availability',
  'experience',
];

/**
 * Calculate doctor profile completion percentage
 * Returns 0-100
 */
function calculateProfileCompletion(doctorUser) {
  if (!doctorUser || doctorUser.role !== 'doctor') {
    return 0;
  }

  let completedFields = 0;
  const totalFields = REQUIRED_FIELDS.length;

  REQUIRED_FIELDS.forEach(field => {
    const value = doctorUser[field];
    let isComplete = false;

    if (Array.isArray(value)) {
      isComplete = value.length > 0;  // Non-empty array = complete
    } else if (typeof value === 'string') {
      isComplete = value.trim().length > 0;  // Non-empty string = complete
    } else if (typeof value === 'number') {
      isComplete = value > 0;  // Number > 0 = complete
    } else {
      isComplete = !!value;  // Truthy = complete
    }

    if (isComplete) completedFields++;
  });

  return Math.round((completedFields / totalFields) * 100);
}

/**
 * Check if doctor profile is complete and can go online
 * Returns true only if:
 * 1. Doctor is approved by admin
 * 2. Profile is 100% complete
 */
function canDoctorGoOnline(doctorUser) {
  if (!doctorUser || doctorUser.role !== 'doctor') {
    return false;
  }

  // Must be approved
  if (doctorUser.approvalStatus !== 'approved') {
    return false;
  }

  // Must have 100% complete profile
  const completion = calculateProfileCompletion(doctorUser);
  return completion === 100;
}

/**
 * Get missing required fields for doctor profile
 * Returns array of field names that are incomplete
 */
function getMissingFields(doctorUser) {
  if (!doctorUser || doctorUser.role !== 'doctor') {
    return REQUIRED_FIELDS;
  }

  const missing = [];

  REQUIRED_FIELDS.forEach(field => {
    const value = doctorUser[field];
    let isComplete = false;

    if (Array.isArray(value)) {
      isComplete = value.length > 0;
    } else if (typeof value === 'string') {
      isComplete = value.trim().length > 0;
    } else if (typeof value === 'number') {
      isComplete = value > 0;
    } else {
      isComplete = !!value;
    }

    if (!isComplete) missing.push(field);
  });

  return missing;
}

/**
 * Update user object with calculated completion info
 */
function updateProfileCompletion(doctorUser) {
  if (!doctorUser || doctorUser.role !== 'doctor') {
    return doctorUser;
  }

  const completion = calculateProfileCompletion(doctorUser);
  doctorUser.profileCompletionPercentage = completion;
  doctorUser.isApprovedAndComplete = doctorUser.approvalStatus === 'approved' && completion === 100;

  return doctorUser;
}

module.exports = {
  calculateProfileCompletion,
  canDoctorGoOnline,
  getMissingFields,
  updateProfileCompletion,
  REQUIRED_FIELDS,
};
