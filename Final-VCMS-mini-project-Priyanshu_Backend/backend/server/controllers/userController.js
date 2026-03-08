const User = require('../models/User');
const MedicalHistory = require('../models/MedicalHistory');
const { calculateProfileCompletion, canDoctorGoOnline, getMissingFields, updateProfileCompletion } = require('../utils/profileCompletion');
const { parseLocationFields } = require('../utils/locationParser');

// Get all users with pagination and filters (admin only)
const getAllUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (role) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all doctors (for patients to book appointments)
const getDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, specialization, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // hide any legacy placeholder entries
    const filter = { role: 'doctor', isActive: true, email: { $not: /^placeholder_/ } };
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const doctors = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      doctors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all patients (doctor/admin only)
const getPatients = async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Forbidden: doctor/admin only' });
    }

    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { role: 'patient', isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const patients = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({
      success: true,
      patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by id
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user (admin or own profile)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Allow admin to update any user, or user to update their own profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Forbidden: can only update your own profile' });
    }

    const updates = req.body;
    delete updates.password; // password update has separate flow
    delete updates.role; // prevent non-admin from changing their role

    if (updates.symptoms !== undefined) {
      updates.symptoms = Array.isArray(updates.symptoms)
        ? updates.symptoms
        : [updates.symptoms].filter(Boolean);
      updates.expertise_symptoms = updates.symptoms;
    }

    if (updates.languages !== undefined) {
      updates.languages = Array.isArray(updates.languages)
        ? updates.languages
        : [updates.languages].filter(Boolean);
    }

    if (updates.qualifications !== undefined) {
      updates.qualifications = Array.isArray(updates.qualifications)
        ? updates.qualifications
        : [updates.qualifications].filter(Boolean);
    }

    // Parse/normalize location fields for consistent doctor/public profile data
    if (updates.location || updates.city || updates.state) {
      const parsed = parseLocationFields({
        location: updates.location,
        city: updates.city,
        state: updates.state,
      });

      updates.location = parsed.location || updates.location;
      updates.city = parsed.city || updates.city;
      updates.state = parsed.state || updates.state;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // ✅ NEW: Calculate profile completion for doctors
    if (user.role === 'doctor') {
      updateProfileCompletion(user);
      await user.save();
    }
    
    res.json({ success: true, user });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete/deactivate user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle doctor online/offline status (doctor only)
const toggleDoctorOnlineStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    
    // Better error handling for missing/invalid user
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Not authenticated - no user found',
        authenticated: false
      });
    }
    
    // Check role with case-insensitive comparison
    const userRole = String(req.user.role || '').trim().toLowerCase();
    if (userRole !== 'doctor') {
      // Role mismatch handled
      return res.status(403).json({ 
        message: `Access denied - expected 'doctor' role, got '${userRole}'`,
        userRole,
        requiresDoctor: true
      });
    }

    const doctor = await User.findById(userId).select('+role +approvalStatus +onlineStatus');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Verify role from DB fetch
    const dbRole = String(doctor.role || '').trim().toLowerCase();
    if (dbRole !== 'doctor') {
      return res.status(403).json({ 
        message: 'User in database is not a doctor',
        dbRole
      });
    }

    // Check if doctor has complete profile and is approved
    const isCurrentlyOffline = doctor.onlineStatus !== 'online';
    if (isCurrentlyOffline && !canDoctorGoOnline(doctor)) {
      const missing = getMissingFields(doctor);
      const completion = calculateProfileCompletion(doctor);
      
      return res.status(400).json({
        success: false,
        message: `Cannot go online - profile is ${completion}% complete. Please complete all required fields.`,
        completion,
        missingFields: missing,
        isApproved: doctor.approvalStatus === 'approved',
        needsApproval: doctor.approvalStatus !== 'approved'
      });
    }

    // Toggle online status
    const previousStatus = doctor.onlineStatus;
    doctor.onlineStatus = doctor.onlineStatus === 'online' ? 'offline' : 'online';
    doctor.available = doctor.onlineStatus === 'online';
    await doctor.save();

    res.json({
      success: true,
      message: `Doctor status changed from ${previousStatus} to ${doctor.onlineStatus}`,
      onlineStatus: doctor.onlineStatus,
      available: doctor.available,
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Get doctor profile completion (doctor only)
const getDoctorProfileCompletion = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userRole = String(req.user?.role || '').trim().toLowerCase();
    if (!req.user || userRole !== 'doctor') {
      return res.status(403).json({ message: 'Forbidden: doctors only' });
    }

    const doctor = await User.findById(userId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const completion = calculateProfileCompletion(doctor);
    const missing = getMissingFields(doctor);
    const canGoOnline = canDoctorGoOnline(doctor);

    // Enforce rule: only approved + 100% complete doctors can stay online
    if (!canGoOnline && (doctor.onlineStatus === 'online' || doctor.available === true)) {
      doctor.onlineStatus = 'offline';
      doctor.available = false;
    }

    // Keep derived fields in sync
    const shouldBeApprovedAndComplete = canGoOnline;
    if (doctor.profileCompletionPercentage !== completion) {
      doctor.profileCompletionPercentage = completion;
    }
    if (doctor.isApprovedAndComplete !== shouldBeApprovedAndComplete) {
      doctor.isApprovedAndComplete = shouldBeApprovedAndComplete;
    }

    await doctor.save();

    res.json({
      success: true,
      profileCompletionPercentage: completion,
      missingFields: missing,
      canGoOnline,
      approvalStatus: doctor.approvalStatus,
      isApprovedAndComplete: doctor.isApprovedAndComplete,
      onlineStatus: doctor.onlineStatus,
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

// Toggle user active/inactive status (admin only)
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Toggle status (if it exists and is boolean, toggle it; otherwise set to inactive/active)
    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save();

    res.json({
      success: true,
      message: `User status toggled to ${user.status}`,
      user: user.toObject({ getters: true, virtuals: false })
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
    doctor.available = doctor.onlineStatus === 'online';
    doctor.available = doctor.onlineStatus === 'online';
  }
};

// Get patient medical history (doctor or admin can view any patient's history)
const getPatientMedicalHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify requester is doctor or admin
    const requesterRole = String(req.user?.role || '').trim().toLowerCase();
    if (!req.user || !['doctor', 'admin'].includes(requesterRole)) {
      return res.status(403).json({ message: 'Forbidden: doctors and admins only' });
    }

    // Get patient details 
    const patient = await User.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const entries = await MedicalHistory.find({ patientId })
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .lean();

    const history = entries.map((entry) => {
      const doctorCreated = !!entry.doctorId;
      const noteParts = [
        entry.description ? `Description: ${entry.description}` : '',
        entry.diagnosis ? `Diagnosis: ${entry.diagnosis}` : '',
        entry.treatment ? `Treatment: ${entry.treatment}` : '',
      ].filter(Boolean);

      return {
        _id: entry._id,
        condition: entry.condition || 'General',
        diagnosedDate: entry.date || entry.createdAt,
        createdAt: entry.createdAt,
        status: doctorCreated ? 'Doctor-Added' : 'Self-Reported',
        notes: noteParts.join('\n') || undefined,
        medications: entry.treatment ? [entry.treatment] : [],
        description: entry.description || '',
        diagnosis: entry.diagnosis || '',
        treatment: entry.treatment || '',
      };
    });

    res.json({
      success: true,
      history,
      patient: {
        _id: patient._id,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        age: patient.age,
        gender: patient.gender,
        medicalHistory: patient.medicalHistory || 'No medical history recorded',
        symptoms: patient.symptoms || [],
        allergies: patient.allergies || [],
        currentMedications: patient.currentMedications || [],
        surgeries: patient.surgeries || [],
        chronicConditions: patient.chronicConditions || [],
        lastCheckup: patient.lastCheckup,
        bloodType: patient.bloodType,
      },
    });
  } catch (err) {
    // Error handled
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllUsers,
  getDoctors,
  getPatients,
  getUserById,
  updateUser,
  deleteUser,
  toggleUserStatus,
  toggleDoctorOnlineStatus,
  getDoctorProfileCompletion,
  getPatientMedicalHistory,
};
