import mongoose from 'mongoose'

// OTP is stored hashed (bcrypt) and auto-deleted after expiry via TTL index
const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  otpHash: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // MongoDB TTL index — document auto-deleted after 5 minutes
    expires: 300
  }
})

const otpModel = mongoose.models.otp || mongoose.model('otp', otpSchema)

export default otpModel
