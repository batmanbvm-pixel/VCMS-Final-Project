const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const DoctorReview = require("../models/DoctorReview");
const Contact = require("../models/Contact");
const { sendSystemEmail } = require("../utils/emailOtp");
const { calculateProfileCompletion, canDoctorGoOnline } = require("../utils/profileCompletion");

// Ensure only admin can access
const ensureAdmin = (req, res) => {
  const userRole = String(req.user?.role || "").trim().toLowerCase();
  if (!req.user || userRole !== "admin") {
    res.status(403).json({ message: "Forbidden: admin only" });
    return false;
  }
  return true;
};

// Reusable hard-delete helper (user + all related data)
const hardDeleteUserAndRelatedData = async (userId, role) => {
  const Appointment = require('../models/Appointment');
  const Prescription = require('../models/Prescription');
  const MedicalHistory = require('../models/MedicalHistory');
  const DoctorReview = require('../models/DoctorReview');
  const ChatMessage = require('../models/ChatMessage');
  const Notification = require('../models/Notification');
  const ConsultationForm = require('../models/ConsultationForm');

  if (role === 'doctor') {
    await Appointment.deleteMany({ doctorId: userId });
    await Prescription.deleteMany({ doctorId: userId });
    await DoctorReview.deleteMany({ doctorId: userId });
    await ConsultationForm.deleteMany({ doctorId: userId });
  } else if (role === 'patient') {
    await Appointment.deleteMany({ patientId: userId });
    await Prescription.deleteMany({ patientId: userId });
    await MedicalHistory.deleteMany({ patientId: userId });
    await DoctorReview.deleteMany({ patientId: userId });
    await ConsultationForm.deleteMany({ patientId: userId });
  }

  await ChatMessage.deleteMany({
    $or: [{ senderId: userId }, { receiverId: userId }]
  });

  await Notification.deleteMany({
    $or: [{ userId: userId }, { fromUserId: userId }]
  });

  await User.findByIdAndDelete(userId);
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

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }),
    ]);

    const normalizedUsers = users.map((u) => {
      try {
        const userObj = u.toObject();
        const rawStatus = String(userObj.approvalStatus || '').toLowerCase();

        // Normalize legacy/inconsistent records so all admin pages show same state
        if (userObj.role === 'patient') {
          if (userObj.isApproved === true) {
            userObj.approvalStatus = 'approved';
          } else if (!rawStatus) {
            userObj.approvalStatus = 'pending';
          }
        }

        if (userObj.role === 'doctor') {
          const completion = calculateProfileCompletion(userObj);
          userObj.profileCompletionPercentage = completion;
          const looksApproved = !!userObj.approvedAt || userObj.isPublic === true;
          if (looksApproved && rawStatus !== 'rejected') {
            userObj.approvalStatus = 'approved';
          } else if (!rawStatus) {
            userObj.approvalStatus = 'pending';
          }

          const canBeOnline = canDoctorGoOnline(userObj);
          userObj.isApprovedAndComplete = canBeOnline;
          if (!canBeOnline) {
            userObj.onlineStatus = 'offline';
            userObj.available = false;
          }
        }

        return userObj;
      } catch (mapError) {
        console.error('Error mapping user:', u._id, mapError.message);
        return u.toObject();
      }
    });

    res.json({
      success: true,
      users: normalizedUsers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getUsers error:', error);
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

    // Filter out appointments with deleted users (null references)
    const validAppointments = appointments.filter(apt => apt.patientId && apt.doctorId);

    const formattedAppointments = validAppointments.map((apt) => ({
      ...apt.toObject(),
      patientName: apt.patientId?.name || apt.patientName || 'Unknown Patient',
      doctorName: apt.doctorId?.name || apt.doctorName || 'Unknown Doctor',
      doctorSpecialization: apt.doctorId?.specialization || apt.specialization || 'General',
      patientId: apt.patientId?._id || apt.patientId,
      doctorId: apt.doctorId?._id || apt.doctorId,
    }));

    res.json({
      success: true,
      appointments: formattedAppointments,
      pagination: {
        total: validAppointments.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(validAppointments.length / parseInt(limit)),
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

    // Email notification (real email when SMTP is configured)
    await sendSystemEmail({
      to: doctor.email,
      subject: '✅ MediConnect - Registration Approved',
      text: `Hello ${doctor.name}, your MediConnect doctor registration has been approved. You can now login and start consultations.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background:#0ea5e9;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">MediConnect Virtual Healthcare</h2>
          </div>
          <div style="border:1px solid #bae6fd;border-top:0;padding:20px;border-radius:0 0 10px 10px;background:#f0f9ff;">
            <p>Hello <strong>${doctor.name}</strong>,</p>
            <p>Welcome to MediConnect 🎉</p>
            <p>Your doctor registration has been <strong style="color:#059669;">approved</strong>. You can now login and start offering consultations.</p>
            <p style="margin-top:18px;color:#475569;">Thank you for joining MediConnect.</p>
          </div>
        </div>
      `,
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
    const rejectionText = String(reason || '').trim();
    const admin = req.user;

    if (!rejectionText) {
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

    // Email notification before permanent removal
    await sendSystemEmail({
      to: doctor.email,
      subject: '❌ MediConnect - Registration Update',
      text: `Hello ${doctor.name}, unfortunately your MediConnect registration was declined. Reason: ${rejectionText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background:#0ea5e9;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">MediConnect Virtual Healthcare</h2>
          </div>
          <div style="border:1px solid #bae6fd;border-top:0;padding:20px;border-radius:0 0 10px 10px;background:#f8fafc;">
            <p>Hello <strong>${doctor.name}</strong>,</p>
            <p>We reviewed your doctor registration request.</p>
            <p style="color:#b91c1c;"><strong>Unfortunately, your registration was declined.</strong></p>
            <p><strong>Reason:</strong> ${rejectionText}</p>
            <p style="margin-top:18px;color:#475569;">You may update details and contact support/admin for re-evaluation.</p>
          </div>
        </div>
      `,
    });

    // HARD DELETE on rejection: remove account + related data permanently
    await hardDeleteUserAndRelatedData(doctorId, 'doctor');

    res.json({
      success: true,
      message: 'Doctor rejected and permanently deleted from database',
      doctorId,
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
    const rawMessage = req.body?.message;
    const normalizedMessage = typeof rawMessage === 'string'
      ? rawMessage
      : rawMessage == null
        ? ''
        : JSON.stringify(rawMessage);

    const finalMessage = normalizedMessage.trim()
      ? normalizedMessage.trim()
      : 'Administrative warning issued. Please review your recent activity and follow platform guidelines.';

    const user = await User.findById(userId).select('_id name').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add warning (atomic update to support legacy/incomplete user documents)
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          adminWarnings: {
            message: finalMessage,
            givenAt: new Date(),
            givenBy: req.user._id,
          },
        },
      },
      { runValidators: false }
    );

    // Notify user
    try {
      const Notification = require('../models/Notification');
      const socketHandler = require('../utils/socketHandler');

      const notif = await Notification.create({
        userId: userId,
        title: 'Admin Warning',
        message: `You have received a warning from admin: ${finalMessage}`,
        type: 'admin-warning',
        from: req.user._id,
        priority: 'high',
      });

      socketHandler.emitToUser(userId.toString(), 'notification', notif);
      socketHandler.emitToUser(userId.toString(), 'admin:warning', {
        warningMessage: finalMessage,
        timestamp: new Date(),
      });
    } catch (nErr) {
      // Notification error handled
    }

    res.json({
      success: true,
      message: `Warning sent to ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('warnUser error:', error);
    res.status(500).json({ message: 'Failed to send warning to user', error: error.message });
  }
};

// Admin deletes user
const deleteUser = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { userId } = req.params;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // HARD DELETE: Permanently remove user and all related data from database
    await hardDeleteUserAndRelatedData(userId, user.role);

    res.json({
      success: true,
      message: `User ${user.name} and all related data permanently deleted from database`,
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
      approvalStatus: { $in: ['pending', null] },
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
      approvalStatus: { $in: ['pending', null] },
      isApproved: { $ne: true },
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
    if (!patient || patient.role !== 'patient' || patient.isDeleted) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.approvalStatus && patient.approvalStatus !== 'pending') {
      return res.status(400).json({ message: `Patient is already ${patient.approvalStatus}` });
    }

    patient.approvalStatus = 'approved';
    patient.isApproved = true;
    patient.approvedBy = req.user._id;
    patient.approvedAt = new Date();
    await patient.save();

    // In-app notification + socket
    const Notification = require('../models/Notification');
    const socketHandler = require('../utils/socketHandler');
    try {
      await Notification.create({
        userId: patientId,
        title: 'Registration Approved',
        message: 'Your registration has been approved! You can now login.',
        type: 'system',
        from: req.user._id,
      });
      socketHandler.emitToUser(patientId.toString(), 'patient:approved', {
        message: 'Your registration has been approved',
      });
    } catch (nErr) {
      // Notification error handled
    }

    // Email notification
    await sendSystemEmail({
      to: patient.email,
      subject: '✅ MediConnect - Registration Approved',
      text: `Hello ${patient.name}, your MediConnect registration has been approved. You can now login.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background:#0ea5e9;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">MediConnect Virtual Healthcare</h2>
          </div>
          <div style="border:1px solid #bae6fd;border-top:0;padding:20px;border-radius:0 0 10px 10px;background:#f0f9ff;">
            <p>Hello <strong>${patient.name}</strong>,</p>
            <p>Welcome to MediConnect 🎉</p>
            <p>Your registration has been <strong style="color:#059669;">approved</strong>. You can now login and access services.</p>
          </div>
        </div>
      `,
    });

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
    const rejectionText = String(reason || '').trim() || 'Not specified';

    const patient = await User.findById(patientId);
    if (!patient || patient.role !== 'patient' || patient.isDeleted) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.approvalStatus && patient.approvalStatus !== 'pending') {
      return res.status(400).json({ message: `Patient is already ${patient.approvalStatus}` });
    }

    // Email notification before permanent removal
    await sendSystemEmail({
      to: patient.email,
      subject: '❌ MediConnect - Registration Update',
      text: `Hello ${patient.name}, unfortunately your MediConnect registration was declined. Reason: ${rejectionText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
          <div style="background:#0ea5e9;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">
            <h2 style="margin:0;">MediConnect Virtual Healthcare</h2>
          </div>
          <div style="border:1px solid #bae6fd;border-top:0;padding:20px;border-radius:0 0 10px 10px;background:#f8fafc;">
            <p>Hello <strong>${patient.name}</strong>,</p>
            <p>We reviewed your registration request.</p>
            <p style="color:#b91c1c;"><strong>Unfortunately, your registration was declined.</strong></p>
            <p><strong>Reason:</strong> ${rejectionText}</p>
          </div>
        </div>
      `,
    });

    // HARD DELETE on rejection: remove account + related data permanently
    await hardDeleteUserAndRelatedData(patientId, 'patient');

    res.json({ success: true, message: 'Patient rejected and permanently deleted from database', patientId });
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

    // Format reviews with proper fallbacks for missing populated data
    const formattedReviews = reviews.map(review => ({
      ...review,
      doctorName: review.doctorId?.name || review.doctorName || 'Doctor',
      doctorSpecialization: review.doctorId?.specialization || review.doctorSpecialization || 'General',
      patientName: review.patientId?.name || review.patientName || 'Patient',
      doctorId: review.doctorId?._id || review.doctorId,
      patientId: review.patientId?._id || review.patientId,
    }));

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
      reviews: formattedReviews,
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

// Delete a review by id (admin only)
const deleteReview = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { reviewId } = req.params;
    const deleted = await DoctorReview.findByIdAndDelete(reviewId);

    if (!deleted) {
      return res.status(404).json({ message: 'Review not found' });
    }

    return res.json({ success: true, message: 'Review deleted successfully', reviewId });
  } catch (error) {
    // Error handled
    return res.status(500).json({ message: 'Server error', error: error.message });
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
  deleteReview,
};
