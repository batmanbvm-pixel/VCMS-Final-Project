const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/userController');

// GET / - Get all users (admin only)
router.get('/', protect, getAllUsers);

// GET /doctors -  Get all doctors (public)
router.get('/doctors', getDoctors);

// GET /patients - Get all patients (doctor/admin only)
router.get('/patients', protect, getPatients);

// ✅ NEW: GET /completion - Get doctor profile completion (doctor only)
router.get('/completion', protect, getDoctorProfileCompletion);

// ✅ NEW: GET /medical-history/:patientId - Get patient's medical history (doctor/admin only)
router.get('/medical-history/:patientId', protect, getPatientMedicalHistory);

// GET /:id - Get user by ID
router.get('/:id', protect, getUserById);

// ✅ NEW: PUT /online-toggle - Toggle doctor online/offline status (doctor only)
router.put('/online-toggle', protect, toggleDoctorOnlineStatus);

// PUT /:id - Update user (admin only)
router.put('/:id', protect, updateUser);

// PUT /:id/toggle-status - Toggle user status (admin only)
router.put('/:id/toggle-status', protect, toggleUserStatus);

// DELETE /:id - Delete user (admin only)
router.delete('/:id', protect, deleteUser);

module.exports = router;