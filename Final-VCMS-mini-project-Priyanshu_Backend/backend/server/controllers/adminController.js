const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const DoctorReview = require("../models/DoctorReview");
const Contact = require("../models/Contact");

// Ensure only admin can access
const ensureAdmin = (req, res) => {
  const userRole = String(req.user?.role || "").trim().toLowerCase();
  if (!req.user || userRole !== "admin") {
    res.status(403).json({ message: "Forbidden: admin only" });
    return false;
  }
  return true;
};

// Get dashboard statistics (Enhanced with Aggregation)
const getDashboardStats = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ✅ NEW: Use aggregation pipeline for better performance
    const stats = await User.aggregate([
      {
        $facet: {
          // Total users (excluding deleted)
          totalUsers: [
            {
              $match: {
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false }
                ]
              }
            },
            { $count: "count" }
          ],
          // Total doctors (excluding deleted)
          totalDoctors: [
            {
              $match: {
                role: "doctor",
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false }
                ]
              }
            },
            { $count: "count" }
          ],
          // Total patients (excluding deleted)
          totalPatients: [
            {
              $match: {
                role: "patient",
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false }
                ]
              }
            },
            { $count: "count" }
          ],
          // Pending approvals (doctors waiting approval)
          pendingDoctors: [
            {
              $match: {
                role: "doctor",
                approvalStatus: { $in: ["pending", null] },
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false }
                ]
              }
            },
            { $count: "count" }
          ],
          // Pending patients waiting approval
          pendingPatients: [
            {
              $match: {
                role: "patient",
                approvalStatus: { $in: ["pending", null] },
                isApproved: { $ne: true },
                $or: [
                  { isDeleted: { $exists: false } },
                  { isDeleted: false }
                ]
              }
            },
            { $count: "count" }
          ],
        }
      }
    ]);

    // Get appointment stats separately (different collection)
    const appointmentStats = await Appointment.aggregate([
      {
        $facet: {
          totalAppointments: [
            { $count: "count" }
          ],
          todayAppointments: [
            {
              $match: {
                date: { $gte: today, $lt: tomorrow }
              }
            },
            { $count: "count" }
          ],
          pendingAppointments: [
            { $match: { status: "pending" } },
            { $count: "count" }
          ],
          confirmedAppointments: [
            { $match: { status: "confirmed" } },
            { $count: "count" }
          ],
          completedAppointments: [
            { $match: { status: "completed" } },
            { $count: "count" }
          ],
          cancelledAppointments: [
            { $match: { status: "cancelled" } },
            { $count: "count" }
          ],
          inProgressAppointments: [
            { $match: { status: "in-progress" } },
            { $count: "count" }
          ],
        }
      }
    ]);

    // Get prescription stats
    const prescriptionStats = await Prescription.aggregate([
      {
        $facet: {
          totalPrescriptions: [
            { $count: "count" }
          ],
          draftPrescriptions: [
            { $match: { status: "draft" } },
            { $count: "count" }
          ],
          issuedPrescriptions: [
            { $match: { status: "issued" } },
            { $count: "count" }
          ],
          viewedPrescriptions: [
            { $match: { status: "viewed" } },
            { $count: "count" }
          ],
        }
      }
    ]);

    // Extract counts from results (handle empty arrays)
    const extractCount = (arr) => (arr.length > 0 ? arr[0].count : 0);

    const userStats = stats[0];
    const appStats = appointmentStats[0];
    const prescStats = prescriptionStats[0];

    res.json({
      success: true,
      stats: {
        // User Statistics
        totalUsers: extractCount(userStats.totalUsers),
        totalDoctors: extractCount(userStats.totalDoctors),
        totalPatients: extractCount(userStats.totalPatients),
        pendingDoctors: extractCount(userStats.pendingDoctors),
        pendingPatients: extractCount(userStats.pendingPatients),

        // Appointment Statistics
        totalAppointments: extractCount(appStats.totalAppointments),
        todayAppointments: extractCount(appStats.todayAppointments),
        pendingAppointments: extractCount(appStats.pendingAppointments),
        confirmedAppointments: extractCount(appStats.confirmedAppointments),
        completedAppointments: extractCount(appStats.completedAppointments),
        cancelledAppointments: extractCount(appStats.cancelledAppointments),
        inProgressAppointments: extractCount(appStats.inProgressAppointments),

        // Prescription Statistics
        totalPrescriptions: extractCount(prescStats.totalPrescriptions),
        draftPrescriptions: extractCount(prescStats.draftPrescriptions),
        issuedPrescriptions: extractCount(prescStats.issuedPrescriptions),
        viewedPrescriptions: extractCount(prescStats.viewedPrescriptions),
      },
      timestamp: new Date(),
    });
  } catch (error) {
    // Error handled
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all users (admin only)
const getUsers = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
    };
    if (role) {
      filter.role = role;
    }
    if (search) {
      filter.$and = [
        { $or: filter.$or },
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        },
      ];
      delete filter.$or;
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
  } catch (error) {
    // Error handled
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all appointments
const getAppointments = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .populate([
        { path: 'patientId', select: '-password' },
        { path: 'doctorId', select: '-password' },
      ])
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    // Error handled
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all contacts (admin only)
const getContacts = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { page = 1, limit = 20, status, priority, userRole, problemType } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (userRole) filter.userRole = userRole;
    if (problemType) filter.problemType = problemType;

    const [total, contacts] = await Promise.all([
      Contact.countDocuments(filter),
      Contact.find(filter)
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
    ]);

    res.json({
      success: true,
      contacts,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Change user role
const changeUserRole = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Valid role is required (patient, doctor, admin)' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User role updated',
      user,
    });
  } catch (error) {
    // Error handled
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get pending doctors (for approval)
const getPendingDoctors = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const total = await User.countDocuments({ 
      role: 'doctor', 
      approvalStatus: 'pending' 
    });

    const doctors = await User.find({ 
      role: 'doctor', 
      approvalStatus: 'pending' 
    })
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

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
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve doctor registration
const approveDoctor = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { doctorId } = req.params;
    const admin = req.user;

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (doctor.approvalStatus !== 'pending') {
      return res.status(400).json({ 
        message: `Doctor is already ${doctor.approvalStatus}` 
      });
    }

    doctor.approvalStatus = 'approved';
    doctor.isPublic = true;
    doctor.isActive = true;
    doctor.approvedBy = admin._id;
    doctor.approvedAt = new Date();
    await doctor.save();

    // Create notification
    const Notification = require('../models/Notification');
    try {
      await Notification.create({
        userId: doctorId,
        title: 'Registration Approved',
        message: 'Your registration has been approved! You can now login.',
        type: 'system',
        from: admin._id,
      });
    } catch (nErr) {
      // Notification error handled
    }

    const socketHandler = require('../utils/socketHandler');
    socketHandler.emitToUser(doctorId.toString(), 'doctor:approved', {
      message: 'Your registration has been approved',
    });

    res.json({
      success: true,
      message: 'Doctor approved successfully',
      doctor: doctor.toObject({ getters: true }),
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reject doctor registration
const rejectDoctor = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { doctorId } = req.params;
    const { reason } = req.body;
    const admin = req.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    if (doctor.approvalStatus !== 'pending') {
      return res.status(400).json({ 
        message: `Doctor is already ${doctor.approvalStatus}` 
      });
    }

    doctor.approvalStatus = 'rejected';
    doctor.rejectionReason = reason;
    doctor.approvedBy = admin._id;
    doctor.rejectedAt = new Date();
    await doctor.save();

    // Create notification
    const Notification = require('../models/Notification');
    try {
      await Notification.create({
        userId: doctorId,
        title: 'Registration Rejected',
        message: `Your registration was rejected. Reason: ${reason}. Please contact admin for more details.`,
        type: 'system',
        from: admin._id,
      });
    } catch (nErr) {
      // Notification error handled
    }

    const socketHandler = require('../utils/socketHandler');
    socketHandler.emitToUser(doctorId.toString(), 'doctor:rejected', {
      message: 'Your registration was rejected',
      reason,
    });

    res.json({
      success: true,
      message: 'Doctor rejected',
      doctor: doctor.toObject({ getters: true }),
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get system reports
const getReports = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const [
      appointmentStats,
      prescriptionStats,
      userStats,
    ] = await Promise.all([
      Appointment.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Prescription.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      reports: {
        appointments: appointmentStats,
        prescriptions: prescriptionStats,
        users: userStats,
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin warns user
const warnUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { userId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Warning message is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add warning
    if (!user.adminWarnings) user.adminWarnings = [];
    user.adminWarnings.push({
      message: message.trim(),
      givenAt: new Date(),
      givenBy: req.user._id,
    });

    await user.save();

    // Notify user
    try {
      const Notification = require('../models/Notification');
      const socketHandler = require('../utils/socketHandler');

      const notif = await Notification.create({
        userId: userId,
        title: 'Admin Warning',
        message: `You have received a warning from admin: ${message}`,
        type: 'admin-warning',
        from: req.user._id,
        priority: 'high',
      });

      socketHandler.emitToUser(userId.toString(), 'notification', notif);
      socketHandler.emitToUser(userId.toString(), 'admin:warning', {
        warningMessage: message,
        timestamp: new Date(),
      });
    } catch (nErr) {
      // Notification error handled
    }

    res.json({
      success: true,
      message: `Warning sent to ${user.name}`,
      user,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Admin deletes user
const deleteUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.name} has been deleted`,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get pending doctors list
const getPendingDoctorsList = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const doctors = await User.find({
      role: 'doctor',
      approvalStatus: 'pending',
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      doctors,
      count: doctors.length,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get pending patients list
const getPendingPatients = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const patients = await User.find({
      role: 'patient',
      approvalStatus: 'pending',
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      patients,
      count: patients.length,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Approve patient
const approvePatient = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { patientId } = req.params;

    const patient = await User.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    patient.approvalStatus = 'approved';
    patient.approvedBy = req.user._id;
    patient.approvedAt = new Date();
    await patient.save();

    res.json({ success: true, message: 'Patient approved', patient });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reject patient
const rejectPatient = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { patientId } = req.params;
    const { reason } = req.body;

    const patient = await User.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    patient.approvalStatus = 'rejected';
    patient.rejectionReason = reason || 'Not specified';
    patient.rejectedAt = new Date();
    await patient.save();

    res.json({ success: true, message: 'Patient rejected', patient });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all reviews with pagination and filtering
const getAllReviews = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minRating,
      maxRating,
      doctorId,
      patientId,
    } = req.query;

    const query = {};

    // Filter by rating range
    if (minRating) query.rating = { $gte: parseInt(minRating) };
    if (maxRating) query.rating = { ...query.rating, $lte: parseInt(maxRating) };

    // Filter by doctor or patient
    if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [reviews, total] = await Promise.all([
      DoctorReview.find(query)
        .populate('doctorId', 'name email specialization')
        .populate('patientId', 'name email')
        .populate('appointmentId', 'appointmentDate status')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DoctorReview.countDocuments(query)
    ]);

    // Calculate average rating
    const avgResult = await DoctorReview.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    res.json({
      reviews,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      averageRating: avgResult.length > 0 ? avgResult[0].avgRating : 0
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getAppointments,
  getContacts,
  changeUserRole,
  getReports,
  getPendingDoctors,
  getPendingDoctorsList,
  getPendingPatients,
  approveDoctor,
  rejectDoctor,
  approvePatient,
  rejectPatient,
  warnUser,
  deleteUser,
  getAllReviews,
};
