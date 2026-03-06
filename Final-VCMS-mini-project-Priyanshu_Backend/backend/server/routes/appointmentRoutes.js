const express = require("express");
const router = express.Router();
const { check } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');

const { protect } = require("../middleware/authMiddleware");
const {
  createAppointment,
  getAppointments,
  getTodayAppointments,
  getAppointmentById,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  acceptAppointment,
  rejectAppointment,
  cancelAppointment,
  getAvailableSlots,
  getAppointmentAnalytics,
  getDoctorDemandAnalytics,
  patientRequestDeletion,
  doctorRejectWithWarning,
  adminSendWarningToDoctor,
  clearCancelledAppointments,
} = require("../controllers/appointmentController");

// POST / - Create appointment (patient only)
router.post(
  "/",
  protect,
  [
    check('doctorId').notEmpty().withMessage('doctorId is required'),
    check('date').notEmpty().withMessage('date is required'),
    check('time').notEmpty().withMessage('time is required'),
  ],
  validateRequest,
  createAppointment
);

// GET /available-slots - Get available appointment slots
router.get("/available-slots", getAvailableSlots);

// GET / - Get appointments (based on role)
router.get("/", protect, getAppointments);

// DELETE /cancelled/clear - Clear all cancelled appointments for current user
router.delete('/cancelled/clear', protect, clearCancelledAppointments);

// GET /today - Get today's appointments (doctor only)
router.get("/today", protect, getTodayAppointments);

// GET /:id - Get single appointment
router.get("/:id", protect, getAppointmentById);

// POST /:id/accept - Doctor accepts appointment
router.post("/:id/accept", protect, acceptAppointment);

// POST /:id/reject - Doctor rejects appointment
router.post("/:id/reject", protect, [
  check('reason').notEmpty().withMessage('Rejection reason is required'),
], validateRequest, rejectAppointment);

// POST /:id/cancel - Patient/Doctor cancels appointment
router.post("/:id/cancel", protect, [
  check('reason').optional(),
], validateRequest, cancelAppointment);

// PUT /:id - Update appointment
router.put("/:id", protect, updateAppointment);

// PUT /:id/status - Update appointment status (doctor/admin only)
router.put("/:id/status", protect, updateAppointmentStatus);

// POST /:id/complete - Mark appointment as complete (doctor or patient)
router.post("/:id/complete", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const Appointment = require("../models/Appointment");
    const Notification = require("../models/Notification");
    const socketHandler = require('../utils/socketHandler');

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check authorization - both doctor and patient can complete
    const patientId = appointment.patientId?.toString() || appointment.patient?.toString();
    const doctorId = appointment.doctorId?.toString() || appointment.doctor?.toString();
    
    if (req.user._id.toString() !== patientId && 
        req.user._id.toString() !== doctorId && 
        req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Update status to completed
    appointment.status = 'completed';
    await appointment.save();

    // Notify the other party
    const otherUserId = req.user._id.toString() === patientId ? doctorId : patientId;
    
    try {
      const notif = await Notification.create({
        userId: otherUserId,
        title: 'Consultation Completed',
        message: 'The video consultation has been completed',
        type: 'appointment',
        from: req.user._id,
        link: `/appointments/${appointment._id}`,
      });
      socketHandler.emitToUser(otherUserId, 'notification', notif);
      socketHandler.emitToUser(otherUserId, 'appointment:status-changed', {
        appointmentId: appointment._id,
        status: 'completed',
      });
    } catch (nErr) {
      // Notification error handled
    }

    const updatedAppointment = await Appointment.findById(id).populate([
      { path: 'patientId', select: '-password' },
      { path: 'doctorId', select: '-password' },
    ]);

    return res.json({
      success: true,
      message: 'Appointment marked as completed',
      appointment: updatedAppointment,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE /:id - Delete/cancel appointment
router.delete("/:id", protect, deleteAppointment);

// New analytics and enhanced rejection endpoints
// GET /analytics/dashboard - Get appointment analytics (admin only)
router.get("/analytics/dashboard", protect, getAppointmentAnalytics);

// GET /analytics/demand - Get doctor demand analytics (admin only)
router.get("/analytics/demand", protect, getDoctorDemandAnalytics);

// POST /:id/patient-delete - Patient requests deletion with reason
router.post("/:id/patient-delete", protect, [
  check('reason').optional(),
], validateRequest, patientRequestDeletion);

// POST /:id/doctor-reject - Doctor rejects with warning (enhanced)
router.post("/:id/doctor-reject", protect, [
  check('reason').notEmpty().withMessage('Rejection reason is required'),
], validateRequest, doctorRejectWithWarning);

// POST /admin/doctor/:doctorId/warning - Send warning to doctor
router.post("/admin/doctor/:doctorId/warning", protect, [
  check('reason').notEmpty().withMessage('Warning reason is required'),
  check('message').optional(),
], validateRequest, adminSendWarningToDoctor);

module.exports = router;
