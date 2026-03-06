const mongoose = require('mongoose');

const doctorReviewSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      default: 'Anonymous Patient',
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    verifiedBooking: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

doctorReviewSchema.index({ doctorId: 1, createdAt: -1 });
doctorReviewSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model('DoctorReview', doctorReviewSchema);
