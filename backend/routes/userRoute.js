import express from 'express'
import {
  registerUser, loginUser, getProfile, updateProfile,
  bookAppointment, listAppointment, cancelAppointment,
  paymentRazorpay, verifyRazorpay
} from '../controllers/userController.js'
import { registerWithOtp, sendOtp, verifyOtp, resendOtp } from '../controllers/otpController.js'
import authUser from '../middlewares/authUser.js'
import upload from '../middlewares/multer.js'
import downloadInvoice from '../controllers/invoiceController.js'
import { generateQrToken } from '../controllers/userController.js'

const userRouter = express.Router()

// ── Auth ─────────────────────────────────────────────────────
userRouter.post('/register', registerWithOtp)  // signup → sends OTP, no JWT yet
userRouter.get('/qr-token/:appointmentId', authUser, generateQrToken)
// OLD single-step login (keep for backward compat or remove once OTP is live)
// userRouter.post('/login', loginUser)

// NEW two-step OTP login
userRouter.post('/login', sendOtp)           // Step 1: check credentials → send OTP
userRouter.post('/verify-otp', verifyOtp)   // Step 2: verify OTP → return JWT
userRouter.post('/resend-otp', resendOtp)   // Resend OTP on request

// ── Profile ──────────────────────────────────────────────────
userRouter.get('/get-profile', authUser, getProfile)
userRouter.post('/update-profile', upload.single('image'), authUser, updateProfile)

// ── Appointments ─────────────────────────────────────────────
userRouter.post('/book-appointment', authUser, bookAppointment)
userRouter.post('/appointments', authUser, listAppointment)
userRouter.post('/cancel-appointment', authUser, cancelAppointment)

// ── Payments ─────────────────────────────────────────────────
userRouter.post('/payment-razorpay', authUser, paymentRazorpay)
userRouter.post('/verifyRazorpay', authUser, verifyRazorpay)

// ── Invoice (add authUser here to fix the security issue) ────
userRouter.get('/invoice/:appointmentId', authUser, downloadInvoice)

export default userRouter
