const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateToken = require('../utils/generateToken');
const tokenManager = require('../utils/tokenManager');
const accountLockout = require('../utils/accountLockout');
const {
  emailOtpStore,
  sendEmailOtp: sendEmailOtpCode,
  verifyEmailOtp: verifyEmailOtpCode,
  clearEmailOtp,
} = require('../utils/emailOtp');
const { parseLocationFields } = require('../utils/locationParser');

// Constants
const LOCKOUT_ATTEMPTS = 5;

// 🔹 REGISTER USER
exports.registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      confirmPassword,
      phone,
      firstName,
      lastName,
      name,
      role,
      specialization,
      experience,
      location,
      city,
      state,
      dateOfBirth,
      age,
    } = req.body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Validate password strength (min 8 chars, 1 uppercase, 1 number, 1 special)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character" 
      });
    }

    // Validate phone (must be 10 digits for India)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone?.replace(/\D/g, ''))) {
      return res.status(400).json({ message: "Phone must be 10 digits" });
    }

    // Validate age for patients (via dateOfBirth or age field)
    if (role === 'patient') {
      let isValidAge = false;
      
      if (dateOfBirth) {
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        isValidAge = calculatedAge >= 18;
      } else if (age) {
        const ageNum = parseInt(age);
        isValidAge = !isNaN(ageNum) && ageNum >= 18;
      }
      
      if (!isValidAge) {
        return res.status(400).json({ message: "Patient must be at least 18 years old" });
      }
    }

    // Normalize and validate email format and domain
    const emailValue = (email || '').trim();
    const emailLower = emailValue.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    // Restrict registrations to Gmail addresses for this project
    const emailDomain = emailLower.split('@')[1] || '';
    if (emailDomain !== 'gmail.com') {
      return res.status(400).json({ message: "Registration allowed only with Gmail addresses (example@gmail.com)" });
    }

    // Doctor-specific validation
    if (role === 'doctor') {
      if (!specialization || specialization.trim() === '') {
        return res.status(400).json({ message: "Specialization is required for doctors" });
      }
      const expNum = parseInt(experience);
      if (isNaN(expNum) || expNum < 0) {
        return res.status(400).json({ message: "Experience must be a non-negative number" });
      }
    }

    // Server-side name validation (same rules as client): allow alphanumeric, spaces and _-.' and require at least one letter
    const nameAllowedRegex = /^[A-Za-z0-9 _\-.'À-ÖØ-öø-ÿ]+$/;
    const hasLetterRegex = /[A-Za-z]/;
    if (firstName) {
      if (!nameAllowedRegex.test(firstName)) return res.status(400).json({ message: "First name contains invalid characters" });
      if (!hasLetterRegex.test(firstName)) return res.status(400).json({ message: "First name must include at least one letter" });
    }
    if (lastName) {
      if (!nameAllowedRegex.test(lastName)) return res.status(400).json({ message: "Last name contains invalid characters" });
      if (!hasLetterRegex.test(lastName)) return res.status(400).json({ message: "Last name must include at least one letter" });
    }

    // Check if user already exists (use normalized email)
    const userExists = await User.findOne({ 
      $or: [{ email: emailLower }, { phone: phone?.replace(/\D/g, '') }] 
    });

    if (userExists) {
      return res.status(400).json({ message: "User with this email or phone already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Calculate age from dateOfBirth if provided, otherwise use provided age
    let calculatedAge = age ? parseInt(age) : null;
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
    }

    // Generate unique username from email (before @) + random number
    const emailPrefix = emailLower.split('@')[0];
    const randomSuffix = Math.floor(Math.random() * 10000);
    let generatedUsername = `${emailPrefix}${randomSuffix}`;
    
    // Ensure username is unique
    let usernameExists = await User.findOne({ username: generatedUsername });
    while (usernameExists) {
      const newSuffix = Math.floor(Math.random() * 10000);
      generatedUsername = `${emailPrefix}${newSuffix}`;
      usernameExists = await User.findOne({ username: generatedUsername });
    }

    const parsedLocation = parseLocationFields({ location, city, state });

    // Create new user (medicalHistory will be added later via profile)
    const user = await User.create({
      name: name || `${firstName || ''} ${lastName || ''}`.trim(),
      username: generatedUsername,
      email: emailLower,
      password: hashedPassword,
      phone: phone?.replace(/\D/g, ''),
      firstName,
      lastName,
      role: role || 'patient',
      specialization: role === 'doctor' ? specialization : undefined,
      experience: role === 'doctor' && experience !== undefined ? parseInt(experience) : undefined,
      location: role === 'doctor' ? parsedLocation.location : undefined,
      city: role === 'doctor' ? parsedLocation.city : undefined,
      state: role === 'doctor' ? parsedLocation.state : undefined,
      dateOfBirth,
      age: calculatedAge,
      // medicalHistory intentionally not stored at registration; patients add it later in their dashboard
      // NEW: Set approvalStatus to "pending" for all users (required for backward compatibility)
      approvalStatus: 'pending',
    });

    const token = generateToken(user);

    // Broadcast to admins about new doctor registration
    if (role === 'doctor') {
      try {
        const socketHandler = require('../utils/socketHandler');
        socketHandler.broadcastDoctorRegistered({
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          specialization: user.specialization,
          approvalStatus: user.approvalStatus,
          createdAt: user.createdAt,
        });
      } catch (err) {
        // Broadcast failed silently for production
      }
    }

    // Do not return an access token for newly registered users until admin approves them.
    res.status(201).json({
      message: "Registration submitted. Awaiting admin approval.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
      token: null,
    });
  } catch (error) {
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `A user with this ${field} already exists` 
      });
    }
    
    res.status(500).json({ 
      message: error.message || "Registration failed. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🔹 LOGIN USER (Enhanced with Account Lockout)
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    // Normalize email and restrict login to Gmail addresses as well
    const emailLower = (email || '').trim().toLowerCase();
    const domain = emailLower.split('@')[1] || '';
    if (domain !== 'gmail.com') {
      return res.status(400).json({ message: "Please use a Gmail address to login (example@gmail.com)" });
    }

    const user = await User.findOne({ email: emailLower });

    if (!user) {
      return res.status(401).json({ message: "Invalid Email or Password" });
    }

    // ✅ NEW: Check if account is locked
    if (accountLockout.isAccountLocked(user)) {
      const status = accountLockout.getLockoutStatus(user);
      return res.status(401).json({
        message: accountLockout.getLockedAccountMessage(user),
        locked: true,
        remainingMinutes: status.remainingMinutes,
        unlocksAt: status.unlocksAt,
      });
    }

    // Check if account is suspended
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        message: "Your account has been suspended. Please contact admin.",
        suspended: true,
      });
    }

    // Check if doctor or patient is approved
    if (user.approvalStatus !== 'approved') {
      if (user.approvalStatus === 'pending') {
        return res.status(403).json({ 
          message: `Your registration is pending admin approval. Please check back later.` 
        });
      } else if (user.approvalStatus === 'rejected') {
        return res.status(403).json({ 
          message: `Your registration was rejected. Reason: ${user.rejectionReason || 'Not specified'}. Please contact admin.` 
        });
      } else if (user.approvalStatus === 'suspended') {
        return res.status(403).json({ 
          message: `Your account has been suspended by admin.` 
        });
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // ✅ NEW: Record failed attempt and check for lockout
      accountLockout.recordFailedAttempt(user);
      await user.save();

      const status = accountLockout.getLockoutStatus(user);
      if (status.locked) {
        return res.status(401).json({
          message: accountLockout.getLockedAccountMessage(user),
          locked: true,
          remainingMinutes: status.remainingMinutes,
          unlocksAt: status.unlocksAt,
        });
      }

      return res.status(401).json({
        message: "Invalid Email or Password",
        attemptsRemaining: LOCKOUT_ATTEMPTS - status.attempts,
      });
    }

    // ✅ NEW: Clear login attempts on successful login
    accountLockout.clearAttempts(user);
    user.lastLoginAt = new Date();
    await user.save();

      // Generate 1-hour access token
      const accessToken = tokenManager.generateAccessToken(user._id, user.email, user.role);

    res.json({
      message: "Login successful",
      token: accessToken,
         accessToken,
         expiresIn: 3600, // 1 hour
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        age: user.age,
        dateOfBirth: user.dateOfBirth,
        medicalHistory: user.medicalHistory,
        specialization: user.specialization,
        gender: user.gender,
        address: user.address,
        profileImage: user.profileImage,
        approvalStatus: user.approvalStatus,
        accountStatus: user.accountStatus,
        city: user.city,
        state: user.state,
        location: user.location,
        experience: user.experience,
        consultationFee: user.consultationFee,
        availability: user.availability || [],
        symptoms: (user.symptoms && user.symptoms.length > 0) ? user.symptoms : (user.expertise_symptoms || []),
        qualifications: user.qualifications || [],
        languages: user.languages || [],
        bio: user.bio || '',
        profileCompletionPercentage: user.profileCompletionPercentage || 0,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 GET CURRENT USER (by token)
exports.getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userObj = user.toObject();
    if ((!Array.isArray(userObj.symptoms) || userObj.symptoms.length === 0) && Array.isArray(userObj.expertise_symptoms)) {
      userObj.symptoms = userObj.expertise_symptoms;
    }

    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 🔹 VALIDATE AVAILABILITY SLOTS - Backend Time Slot Validation
const validateAvailabilitySlots = (availability) => {
  if (!Array.isArray(availability)) {
    return { valid: false, error: "Availability must be an array" };
  }

  // Track slots by day to check for overlaps
  const slotsByDay = {};

  for (const slot of availability) {
    // Check required fields
    if (!slot.day || !slot.startTime || !slot.endTime) {
      return { valid: false, error: "Each slot must have day, startTime, and endTime" };
    }

    // Validate HH:MM format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(slot.startTime)) {
      return { valid: false, error: `Invalid startTime format: ${slot.startTime}. Use HH:MM format (00:00-23:59)` };
    }
    if (!timeRegex.test(slot.endTime)) {
      return { valid: false, error: `Invalid endTime format: ${slot.endTime}. Use HH:MM format (00:00-23:59)` };
    }

    // Convert times to minutes for comparison
    const [startHours, startMins] = slot.startTime.split(':').map(Number);
    const [endHours, endMins] = slot.endTime.split(':').map(Number);
    const startTotalMins = startHours * 60 + startMins;
    const endTotalMins = endHours * 60 + endMins;

    // Validate start < end
    if (startTotalMins >= endTotalMins) {
      return { valid: false, error: `Invalid time range: ${slot.startTime}-${slot.endTime}. Start time must be before end time` };
    }

    // Check for overlaps on same day
    if (!slotsByDay[slot.day]) {
      slotsByDay[slot.day] = [];
    }

    for (const existingSlot of slotsByDay[slot.day]) {
      const [existStart, existEnd] = [existingSlot.startMins, existingSlot.endMins];
      // Check if ranges overlap: start < other.end AND end > other.start
      if (startTotalMins < existEnd && endTotalMins > existStart) {
        return { valid: false, error: `Time slot ${slot.startTime}-${slot.endTime} overlaps with existing slot on ${slot.day}` };
      }
    }

    slotsByDay[slot.day].push({ startMins: startTotalMins, endMins: endTotalMins });
  }

  return { valid: true };
};

// 🔹 UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Load the user document so we can apply updates and save
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Role-specific updates
    if (user.role === "doctor") {
      if (req.body.specialization) user.specialization = req.body.specialization;
      if (req.body.consultationFee) user.consultationFee = req.body.consultationFee;
      if (req.body.location) user.location = req.body.location;
      if (req.body.city !== undefined) user.city = req.body.city;
      if (req.body.state !== undefined) user.state = req.body.state;
      if (req.body.experience !== undefined) user.experience = req.body.experience;

      if (req.body.availableSlots)
        user.availableSlots = Array.isArray(req.body.availableSlots)
          ? req.body.availableSlots
          : [req.body.availableSlots];

      if (req.body.availableDays)
        user.availableDays = Array.isArray(req.body.availableDays)
          ? req.body.availableDays
          : [req.body.availableDays];

      if (req.body.availability && Array.isArray(req.body.availability)) {
        // Validate availability slots before saving
        const validation = validateAvailabilitySlots(req.body.availability);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.error });
        }
        user.availability = req.body.availability;
      }

      if (req.body.symptoms) {
        user.symptoms = Array.isArray(req.body.symptoms)
          ? req.body.symptoms
          : [req.body.symptoms];
        user.expertise_symptoms = user.symptoms;
      }

      if (req.body.bio !== undefined) user.bio = req.body.bio;
      if (req.body.qualifications !== undefined) {
        user.qualifications = Array.isArray(req.body.qualifications)
          ? req.body.qualifications
          : [req.body.qualifications].filter(Boolean);
      }
      if (req.body.languages !== undefined) {
        user.languages = Array.isArray(req.body.languages)
          ? req.body.languages
          : [req.body.languages].filter(Boolean);
      }

      if (req.body.location || req.body.city || req.body.state) {
        const parsed = parseLocationFields({
          location: user.location,
          city: user.city,
          state: user.state,
        });
        user.location = parsed.location || user.location;
        user.city = parsed.city || user.city;
        user.state = parsed.state || user.state;
      }
    }

    if (user.role === "patient") {
      if (req.body.age !== undefined) user.age = req.body.age;
      if (req.body.dateOfBirth) user.dateOfBirth = req.body.dateOfBirth;
      if (req.body.medicalHistory !== undefined) user.medicalHistory = req.body.medicalHistory;
    }

    // Common fields
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.address !== undefined) user.address = req.body.address;
    if (req.body.firstName !== undefined) user.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) user.lastName = req.body.lastName;
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.profileImage !== undefined) user.profileImage = req.body.profileImage;
    if (req.body.gender !== undefined) user.gender = req.body.gender;

    await user.save();
    const updatedUser = await User.findById(user._id).select("-password");
    return res.json({ success: true, user: updatedUser });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔹 CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// OTP Management - Store in memory with TTL (for college project, no persistent storage needed)
const otpStore = new Map(); // Format: { phone: { code: "123456", expiresAt: timestamp } }

// 🔹 SEND OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ message: "Phone must be 10 digits" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(cleanPhone, { code: otp, expiresAt: expiryTime });

    // In a real app, send via SMS. For college project, log it silently.

    res.json({
      success: true,
      message: `OTP sent to phone ending in ${cleanPhone.slice(-4)}`,
      // For testing only - REMOVE IN PRODUCTION
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Send OTP via Email (Better for College Project Testing)
exports.sendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (!existingUser) {
      return res.status(404).json({ message: "No account found with this email" });
    }

    const otp = await sendEmailOtpCode(normalizedEmail);

    res.json({
      success: true,
      message: `OTP sent to ${normalizedEmail}`,
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔹 VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ message: "Phone and OTP code required" });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const storedOtp = otpStore.get(cleanPhone);
    if (!storedOtp) {
      return res.status(400).json({ message: "OTP not found. Please request a new one." });
    }

    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    if (storedOtp.code !== code.toString()) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // OTP verified - keep it for 5 more minutes for password reset
    storedOtp.expiresAt = Date.now() + 5 * 60 * 1000;
    storedOtp.verified = true;

    res.json({
      success: true,
      message: "OTP verified successfully",
      verified: true
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Verify Email OTP
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and OTP code required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = verifyEmailOtpCode(normalizedEmail, code);
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
      verified: true
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔹 RESET PASSWORD (with verified OTP)
exports.resetPassword = async (req, res) => {
  try {
    const { phone, code, newPassword, confirmPassword } = req.body;

    if (!phone || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character"
      });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const storedOtp = otpStore.get(cleanPhone);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP not found. Please request a new one." });
    }

    if (storedOtp.code !== String(code).trim()) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    if (!storedOtp.verified) {
      return res.status(400).json({ message: "OTP not verified. Please verify OTP first." });
    }

    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    // Find user by phone
    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(404).json({ message: "User not found with this phone number" });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();

    // Clear OTP
    otpStore.delete(cleanPhone);

    res.json({
      success: true,
      message: "Password reset successfully. Please login with your new password."
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Reset Password with Email OTP
exports.resetPasswordEmail = async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character"
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const storedOtp = emailOtpStore.get(normalizedEmail);

    if (!storedOtp) {
      return res.status(400).json({ message: "OTP not found. Please request a new one." });
    }

    if (!storedOtp.verified) {
      return res.status(400).json({ message: "OTP not verified. Please verify OTP first." });
    }

    if (Date.now() > storedOtp.expiresAt) {
      clearEmailOtp(normalizedEmail);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    clearEmailOtp(normalizedEmail);

    res.json({
      success: true,
      message: "Password reset successfully. Please login with your new password."
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Access-token only auth flow: refresh token endpoint is disabled
exports.refreshAccessToken = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "Refresh token flow removed. Please login again.",
  });
};

// ✅ NEW: 🔹 LOGOUT USER
exports.logoutUser = async (req, res) => {
  try {
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.lastLogoutAt = new Date();
      await user.save();
    }

    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

// ✅ NEW: 🔹 LOGOUT FROM ALL DEVICES
exports.logoutFromAllDevices = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.lastLogoutAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Logged out from all devices successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

// ✅ NEW: 🔹 GET AUTH STATUS
exports.getAuthStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ authenticated: false });
    }

    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        approvalStatus: user.approvalStatus,
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    res.status(401).json({ authenticated: false, error: error.message });
  }
};

// ✅ NEW: 🔹 ADMIN UNLOCK ACCOUNT
exports.unlockAccount = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only admins can unlock accounts" });
    }

    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Unlock account
    accountLockout.unlockAccount(user);
    await user.save();

    res.json({
      success: true,
      message: `Account unlocked for ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to unlock account", error: error.message });
  }
};


