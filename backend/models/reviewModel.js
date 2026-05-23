import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'appointment', required: true, unique: true },
  doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'doctor',      required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'user',        required: true },

  rating:        { type: Number, required: true, min: 1, max: 5 },
  review:        { type: String, default: '', maxlength: 500 },

  // Snapshot at time of review
  patientName:   { type: String, default: '' },
  patientImage:  { type: String, default: '' },
  doctorName:    { type: String, default: '' },

  // Admin moderation
  isApproved:    { type: Boolean, default: true  }, // auto-approve, admin can hide
  isHidden:      { type: Boolean, default: false },  // admin soft-delete
  hiddenReason:  { type: String,  default: '' },

  createdAt:     { type: Date, default: Date.now },
})

// Index for fast doctor-wise queries
reviewSchema.index({ doctorId: 1, isHidden: 1 })


const reviewModel = mongoose.models.review || mongoose.model('review', reviewSchema)
export default reviewModel