const User = require("../models/User");
const Appointment = require("../models/Appointment");
const DoctorReview = require("../models/DoctorReview");
const mongoose = require('mongoose');
const { parseLocationFields } = require('../utils/locationParser');
// placeholder doctor logic was removed: public doctor endpoint will no
// longer create fake users when a search/filter returns nothing.  All
// doctors shown in the frontend will now correspond to actual
// documents previously inserted by admins or seeded data.

// Helper to map internal User -> PublicDoctorProfile shape expected by frontend
function mapUserToPublicProfile(u) {
  // ensure we always return a usable name and at least some location info
  const isGenericName = (candidate = '', specialization = '') => {
    const normalized = String(candidate || '')
      .replace(/^dr\.?\s*/i, '')
      .replace(/\s+specialist$/i, '')
      .trim()
      .toLowerCase();
    const spec = String(specialization || '').trim().toLowerCase();
    return !!normalized && !!spec && normalized === spec;
  };

  const candidateNames = [u.name, u.displayName].filter(Boolean);
  let rawName = candidateNames.find((n) => !isGenericName(n, u.specialization)) || candidateNames[0] || '';

  // if the chosen name is still just specialization, ignore it
  if (rawName && u.specialization && isGenericName(rawName, u.specialization)) {
    rawName = '';
  }
  const fallbackName = rawName || u.specialization || 'Doctor';
  const rawLocation = u.location || '';
  const parsedLocation = parseLocationFields({
    location: rawLocation,
    city: u.city || '',
    state: u.state || '',
  });
  const city = parsedLocation.city || '';
  const state = parsedLocation.state || '';
  const normalizedLocation = rawLocation.replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedCityState = `${city}, ${state}`.replace(/\s+/g, ' ').trim().toLowerCase();
  const address = normalizedLocation && normalizedLocation === normalizedCityState ? '' : rawLocation;

  return {
    _id: u._id,
    name: fallbackName,
    email: u.email || '',
    phone: u.phone || '',
    specialization: u.specialization || 'General',
    qualifications: u.qualifications || [],
    experience: u.experience || 0,
    bio: u.bio || '',
    avatar: u.profileImage || u.avatar || null,
    location: {
      address: address || '',
      city: city || 'Unknown city',
      state: state || 'Unknown state',
    },
    consultationFee: u.consultationFee || 0,
    rating: (u.reviewCount || 0) > 0 ? (u.rating || 0) : 0,
    totalReviews: u.reviewCount || 0,
    responseTime: u.responseTime || '24 hours',
    availability: u.availability || [],
    availableOnline: !!u.availableOnline,
    availablePhysical: typeof u.availablePhysical === 'boolean' ? u.availablePhysical : true,
    approvalStatus: u.approvalStatus,
  };
}

// Fallback: map raw PublicDoctor document (legacy collection) to frontend shape
function mapRawPublicDoctor(pd) {
  const isGenericName = (candidate = '', specialization = '') => {
    const normalized = String(candidate || '')
      .replace(/^dr\.?\s*/i, '')
      .replace(/\s+specialist$/i, '')
      .trim()
      .toLowerCase();
    const spec = String(specialization || '').trim().toLowerCase();
    return !!normalized && !!spec && normalized === spec;
  };

  const candidateNames = [pd.name, pd.displayName].filter(Boolean);
  let rawName = candidateNames.find((n) => !isGenericName(n, pd.specialization)) || candidateNames[0] || '';
  if (rawName && pd.specialization && isGenericName(rawName, pd.specialization)) {
    rawName = '';
  }
  const fallbackName = rawName || pd.specialization || (pd.doctorId ? String(pd.doctorId) : 'Doctor');
  const city = pd.city || '';
  const state = pd.state || '';
  const rawLocation = pd.location || '';
  const normalizedLocation = rawLocation.replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedCityState = `${city}, ${state}`.replace(/\s+/g, ' ').trim().toLowerCase();
  const address = normalizedLocation && normalizedLocation === normalizedCityState ? '' : rawLocation;

  return {
    _id: pd._id,
    name: fallbackName,
    email: pd.email || '',
    phone: pd.phone || '',
    specialization: pd.specialization || 'General',
    qualifications: pd.qualifications || [],
    experience: pd.experience || 0,
    bio: pd.bio || '',
    avatar: pd.profileImage || pd.avatar || null,
    location: {
      address: address || '',
      city: city || 'Unknown city',
      state: state || 'Unknown state',
    },
    licenseNumber: pd.licenseNumber || '',
    registrationBody: pd.registrationBody || '',
    consultationFee: pd.consultationFee || 0,
    rating: (pd.reviewCount || 0) > 0 ? (pd.rating || 0) : 0,
    totalReviews: pd.reviewCount || 0,
    responseTime: pd.responseTime || '24 hours',
    availability: pd.availability || [],
    availableOnline: !!pd.availableOnline,
    availablePhysical: typeof pd.availablePhysical === 'boolean' ? pd.availablePhysical : true,
    approvalStatus: pd.approvalStatus || 'approved',
  };
}

function isGenericDoctorName(name = '', specialization = '') {
  const n = String(name || '')
    .replace(/^dr\.?\s*/i, '')
    .replace(/\s+specialist$/i, '')
    .trim()
    .toLowerCase();
  const s = String(specialization || '').trim().toLowerCase();
  if (!n || !s) return false;
  return n === s;
}

const updateDoctorRatingStats = async (doctorId) => {
  const stats = await DoctorReview.aggregate([
    { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
    {
      $group: {
        _id: '$doctorId',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  if (!stats.length) {
    await User.findByIdAndUpdate(doctorId, { rating: 0, reviewCount: 0 });
    return { averageRating: 0, reviewCount: 0 };
  }

  const averageRating = Number(stats[0].averageRating.toFixed(1));
  const reviewCount = stats[0].reviewCount;
  await User.findByIdAndUpdate(doctorId, { rating: averageRating, reviewCount });
  return { averageRating, reviewCount };
};

/**
 * Public Controller
 * Handles public (non-authenticated) endpoints for:
 * - Doctor search and browse
 * - Public doctor profiles
 * - Inquiry form submissions
 */

// ✅ NEW: Get all public doctors
exports.getPublicDoctors = async (req, res) => {
  try {
    const { page = 1, limit = 10, specialization, city, search, minRating = 0 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter - ONLY show ONLINE doctors with COMPLETE profiles
    let filter = {
      role: 'doctor',
      email: { $not: /^placeholder_/ },
      isActive: { $ne: false },
      $or: [{ isPublic: true }, { approvalStatus: 'approved' }],
      onlineStatus: 'online',  // FILTER: Only online doctors
        available: true,  // Ensure only available doctors are shown
      isApprovedAndComplete: true,  // FILTER: Only complete profiles
    };

    if (specialization) {
      filter.specialization = { $regex: specialization, $options: 'i' };
    }

    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { expertise_symptoms: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (minRating > 0) {
      filter.reviewCount = { $gt: 0 };
      filter.rating = { $gte: parseFloat(minRating) };
    }

    let total = await User.countDocuments(filter);
    const doctors = await User.find(filter)
      .select('-__v -password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ reviewCount: -1, rating: -1, createdAt: -1 });

    let mapped = doctors
      .map(mapUserToPublicProfile)
      .filter((d) => !isGenericDoctorName(d.name, d.specialization));

    total = mapped.length;

    res.json({
      success: true,
      doctors: mapped,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to fetch doctors", error: error.message });
  }
};

// ✅ NEW: Get single public doctor profile
exports.getPublicDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;

    let doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: { $ne: false }, $or: [{ isPublic: true }, { approvalStatus: 'approved' }] }).select('-__v -password');
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found or profile not public" });
    }

    res.json({ success: true, doctor: mapUserToPublicProfile(doctor) });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to fetch doctor profile", error: error.message });
  }
};

// ✅ NEW: Get specializations (for filtering)
exports.getSpecializations = async (req, res) => {
  try {
    const specializations = await User.aggregate([
      { $match: { role: 'doctor', isActive: { $ne: false }, $or: [{ isPublic: true }, { approvalStatus: 'approved' }] } },
      { $group: { _id: "$specialization", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { specialization: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({
      success: true,
      specializations,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to fetch specializations", error: error.message });
  }
};

// ✅ NEW: Get available symptoms with related specializations
exports.getSymptoms = async (req, res) => {
  try {
    const { limit = 300 } = req.query;

    const symptoms = await User.aggregate([
      {
        $match: {
          role: 'doctor',
          email: { $not: /^placeholder_/ },
          isActive: { $ne: false },
          $or: [{ isPublic: true }, { approvalStatus: 'approved' }],
          onlineStatus: 'online',
          available: true,
          isApprovedAndComplete: true,
          expertise_symptoms: { $exists: true, $ne: [] },
        },
      },
      {
        $project: {
          specialization: 1,
          expertise_symptoms: 1,
        },
      },
      { $unwind: '$expertise_symptoms' },
      {
        $project: {
          specialization: 1,
          symptom: { $trim: { input: { $toLower: '$expertise_symptoms' } } },
        },
      },
      {
        $match: {
          symptom: { $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$symptom',
          specializations: { $addToSet: '$specialization' },
          doctorCount: { $sum: 1 },
        },
      },
      { $sort: { doctorCount: -1, _id: 1 } },
      { $limit: Math.max(1, Math.min(parseInt(limit, 10) || 300, 1000)) },
      {
        $project: {
          _id: 0,
          symptom: '$_id',
          specializations: {
            $filter: {
              input: '$specializations',
              as: 'spec',
              cond: { $ne: ['$$spec', null] },
            },
          },
          doctorCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      symptoms,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to fetch symptoms', error: error.message });
  }
};

// ✅ NEW: Get available cities
exports.getCities = async (req, res) => {
  try {
    const cities = await User.aggregate([
      { $match: { role: 'doctor', isActive: true, isPublic: true, city: { $ne: null } } },
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { city: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({
      success: true,
      cities,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to fetch cities", error: error.message });
  }
};

// ✅ NEW: Search doctors by symptoms (public endpoint)
exports.searchDoctorsBySymptoms = async (req, res) => {
  try {
    const { symptoms, page = 1, limit = 10 } = req.query;

    if (!symptoms) {
      return res.status(400).json({ message: "Symptoms parameter is required" });
    }

    const symptomArray = symptoms.split(",").map(s => s.trim());
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const doctors = await User.find({
      role: 'doctor',
      isActive: true,
      isPublic: true,
      expertise_symptoms: { $in: symptomArray },
    })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1 })
      .select("-__v -password");

    const total = await User.countDocuments({
      role: 'doctor',
      isActive: true,
      isPublic: true,
      expertise_symptoms: { $in: symptomArray },
    });

    res.json({
      success: true,
      doctors,
      queriedSymptoms: symptomArray,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};

// ✅ NEW: Submit guest inquiry form
exports.submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, message, subject } = req.body;

    // Basic validation
    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Contact entries are saved to database via contactController

    res.json({
      success: true,
      message: "Thank you for your inquiry. Our team will contact you soon.",
      inquiryId: `INQ_${Date.now()}`, // Dummy ID for reference
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to submit inquiry", error: error.message });
  }
};

// ✅ NEW: Get doctor availability slots (public)
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ message: "Doctor ID and date are required" });
    }

    // Get doctor's availability
    const doctor = await User.findById(doctorId).select("availability");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Get day of week from date
    const appointmentDate = new Date(date);
    const dayOfWeek = appointmentDate.toLocaleString('en-US', { weekday: 'lowercase' });


    // Find all availability ranges for that day (support multiple slots per day)
    const dayAvailabilities = doctor.availability.filter(
      (av) => av.day && av.day.toLowerCase() === dayOfWeek
    );

    if (!dayAvailabilities || dayAvailabilities.length === 0) {
      return res.json({
        success: true,
        availableSlots: [],
        message: `Doctor not available on ${dayOfWeek}`,
      });
    }

    // Generate time slots (30-minute intervals) for each availability range
    const slots = [];

    for (const range of dayAvailabilities) {
      const [startHour, startMin] = range.startTime.split(":").map(Number);
      const [endHour, endMin] = range.endTime.split(":").map(Number);

      let currentTime = new Date(appointmentDate);
      currentTime.setHours(startHour, startMin, 0);

      const endTime = new Date(appointmentDate);
      endTime.setHours(endHour, endMin, 0);

      while (currentTime < endTime) {
        const hour = currentTime.getHours();
        const min = currentTime.getMinutes();
        const time24 = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const label = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        // Check if booked
        const isBooked = await Appointment.exists({
          doctorId,
          date: {
            $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
            $lt: new Date(appointmentDate.setHours(23, 59, 59, 999)),
          },
          time: time24,
          status: { $in: ['pending', 'confirmed', 'in-progress'] },
        });

        if (!isBooked) {
          slots.push({ time: time24, label, available: true });
        }

        currentTime.setMinutes(currentTime.getMinutes() + 30);
      }
    }

    // Remove duplicates and sort times, preserve label
    const timeLabelMap = new Map();
    for (const s of slots) {
      timeLabelMap.set(s.time, s.label || s.time);
    }
    const uniqueTimes = Array.from(timeLabelMap.keys()).sort((a, b) => {
      const [ah, am] = a.split(':').map(Number);
      const [bh, bm] = b.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
    const uniqueSlots = uniqueTimes.map(t => ({ time: t, label: timeLabelMap.get(t), available: true }));

    res.json({
      success: true,
      availableSlots: uniqueSlots,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Failed to fetch available slots", error: error.message });
  }
};

// Get public doctor reviews
exports.getDoctorReviews = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { page = 1, limit = 5, sortBy = 'recent' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: 'Invalid doctor id' });
    }

    const sort = sortBy === 'rating' ? { rating: -1, createdAt: -1 } : { createdAt: -1 };

    const total = await DoctorReview.countDocuments({ doctorId });
    const reviews = await DoctorReview.find({ doctorId })
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort)
      .lean();

    const stats = await updateDoctorRatingStats(doctorId);

    const ratingBreakdownRaw = await DoctorReview.aggregate([
      { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingBreakdownRaw.forEach((item) => {
      ratingBreakdown[item._id] = item.count;
    });

    res.json({
      success: true,
      reviews,
      total,
      averageRating: stats.averageRating,
      ratingBreakdown,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

// Get all public reviews (paginated)
exports.getPublicReviews = async (req, res) => {
  try {
    const { page = 1, limit = 50, sortBy = 'newest' } = req.query;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const skip = (parsedPage - 1) * parsedLimit;

    const sort = sortBy === 'highest'
      ? { rating: -1, createdAt: -1 }
      : sortBy === 'lowest'
      ? { rating: 1, createdAt: -1 }
      : { createdAt: -1 };

    const [total, reviews] = await Promise.all([
      DoctorReview.countDocuments({}),
      DoctorReview.find({})
        .populate('doctorId', 'name specialization')
        .populate('patientId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
    ]);

    const normalizedReviews = reviews.map((review) => ({
      ...review,
      doctorName: review.doctorName || review.doctorId?.name || 'Doctor',
      doctorSpecialization: review.doctorSpecialization || review.doctorId?.specialization || 'General',
      patientName: review.patientName || review.patientId?.name || 'Verified Patient',
    }));

    res.json({
      success: true,
      reviews: normalizedReviews,
      total,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
};

// Get reviews for logged-in doctor dashboard
exports.getMyDoctorReviews = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can access this endpoint' });
    }

    const { page = 1, limit = 5 } = req.query;
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
    const skip = (parsedPage - 1) * parsedLimit;

    const total = await DoctorReview.countDocuments({ doctorId: req.user._id });
    const reviews = await DoctorReview.find({ doctorId: req.user._id })
      .populate('patientId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const stats = await updateDoctorRatingStats(req.user._id);

    const normalizedReviews = reviews.map((review) => ({
      ...review,
      patientId: review.patientId?._id || review.patientId,
      patientName: review.patientName || review.patientId?.name || 'Verified Patient',
    }));

    res.json({
      success: true,
      reviews: normalizedReviews,
      summary: {
        total,
        averageRating: stats.averageRating,
      },
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to fetch doctor feedback', error: error.message });
  }
};

// Get recent reviews for admin dashboard
exports.getAdminRecentReviews = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can access this endpoint' });
    }

    const { limit = 10 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);

    const [totalReviews, aggregateStats, reviews] = await Promise.all([
      DoctorReview.countDocuments(),
      DoctorReview.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
          },
        },
      ]),
      DoctorReview.find({})
        .populate('doctorId', 'name specialization')
        .populate('patientId', 'name')
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .lean(),
    ]);

    const normalizedReviews = reviews.map((review) => ({
      ...review,
      doctorName: review.doctorId?.name || 'Doctor',
      doctorSpecialization: review.doctorId?.specialization || 'General',
      patientName: review.patientName || review.patientId?.name || 'Verified Patient',
    }));

    const averageRating = aggregateStats.length
      ? Number((aggregateStats[0].averageRating || 0).toFixed(1))
      : 0;

    res.json({
      success: true,
      reviews: normalizedReviews,
      summary: {
        totalReviews,
        averageRating,
      },
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to fetch recent reviews', error: error.message });
  }
};

// Submit patient review after completed consultation
exports.submitReview = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Only patients can submit reviews' });
    }

    const { appointmentId, doctorId, rating, comment = '' } = req.body;
    const numericRating = Number(rating);

    if (!appointmentId || !doctorId || Number.isNaN(numericRating)) {
      return res.status(400).json({ message: 'appointmentId, doctorId and rating are required' });
    }

    if (numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only review your own appointments' });
    }

    if (appointment.doctorId.toString() !== doctorId.toString()) {
      return res.status(400).json({ message: 'Appointment doctor does not match provided doctorId' });
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({ message: 'Review allowed only after completed consultation' });
    }

    if (appointment.reviewSubmitted) {
      return res.status(400).json({ message: 'Review already submitted for this appointment' });
    }

    const existing = await DoctorReview.findOne({ appointmentId });
    if (existing) {
      return res.status(400).json({ message: 'Review already exists for this appointment' });
    }

    const review = await DoctorReview.create({
      appointmentId,
      doctorId,
      patientId: req.user._id,
      patientName: req.user.name || 'Verified Patient',
      rating: numericRating,
      comment,
      verifiedBooking: true,
    });

    appointment.reviewSubmitted = true;
    await appointment.save();

    const stats = await updateDoctorRatingStats(doctorId);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: 'Failed to submit review', error: error.message });
  }
};
