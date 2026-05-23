import mongoose from 'mongoose'

// One prescription = one medicine for one patient after one appointment
// Doctor adds multiple medicines → multiple prescription documents
const prescriptionSchema = new mongoose.Schema({

  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'appointment', required: true },
  doctorId:      { type: mongoose.Schema.Types.ObjectId, ref: 'doctor',      required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'user',        required: true },

  // Medicine details (doctor fills these)
  medicineName:  { type: String, required: true },
  dosage:        { type: String, required: true },   // e.g. "500mg"
  frequency:     { type: String, required: true },   // e.g. "Twice a day"
  timing:        { type: String, default: '' },      // e.g. "After meals"
  durationDays:  { type: Number, required: true },   // e.g. 7

  // Patient info (copied at time of prescription for fast reminder queries)
  patientName:   { type: String, required: true },
  patientEmail:  { type: String, default: '' },
  patientPhone:  { type: String, default: '' },

  // Doctor info (for email)
  doctorName:    { type: String, required: true },

  // Reminder tracking
  startDate:     { type: Date, default: Date.now },
  endDate:       { type: Date, required: true },     // startDate + durationDays
  reminderSent:  { type: Boolean, default: false },  // reset to false each night
  isActive:      { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now }
})

const prescriptionModel = mongoose.models.prescription
  || mongoose.model('prescription', prescriptionSchema)

export default prescriptionModel
