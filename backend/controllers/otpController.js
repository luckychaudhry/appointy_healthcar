import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'
import otpModel from '../models/otpModel.js'
import transporter from '../utils/mailer.js'

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

const otpEmailTemplate = (name, otp, purpose = 'login') => {
  const heading = purpose === 'signup'
    ? 'Appointy — Verify your account'
    : 'Appointy — Verify your login'
  const bodyLine = purpose === 'signup'
    ? "You're almost done! Use the OTP below to verify your email and activate your account. It expires in <strong>5 minutes</strong>."
    : 'Use the OTP below to complete your login. It expires in <strong>5 minutes</strong>.'

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .container{max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
  .header{background:#5F6FFF;padding:28px 32px}
  .header h1{color:#fff;margin:0;font-size:22px}
  .body{padding:32px}
  .otp-box{background:#f0f0ff;border:2px dashed #5F6FFF;border-radius:8px;padding:20px;
    text-align:center;margin:24px 0;letter-spacing:10px;font-size:36px;font-weight:bold;color:#5F6FFF}
  .note{color:#888;font-size:13px;margin-top:16px}
  .footer{background:#f9f9f9;padding:16px 32px;color:#aaa;font-size:12px;text-align:center}
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${heading}</h1></div>
    <div class="body">
      <p>Hi <strong>${name}</strong>,</p>
      <p>${bodyLine}</p>
      <div class="otp-box">${otp}</div>
      <p class="note">If you did not request this, please ignore this email. Do not share this OTP with anyone.</p>
    </div>
    <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
  </div>
</body>
</html>`
}

// shared: generate + hash + save + email OTP
const sendOtpToUser = async (user, purpose) => {
  await otpModel.deleteMany({ userId: user._id })
  const otp = generateOtp()
  const salt = await bcrypt.genSalt(10)
  const otpHash = await bcrypt.hash(otp, salt)
  await otpModel.create({ userId: user._id, otpHash })
  await transporter.sendMail({
    from: `"Appointy" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: purpose === 'signup' ? 'Verify your Appointy account' : 'Your Appointy login OTP',
    html: otpEmailTemplate(user.name, otp, purpose)
  })
}

// ── SIGNUP: create user (unverified) → send OTP ──────────────────────────────
export const registerWithOtp = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body

    if (!name || !email || !password || !phone)
      return res.json({ success: false, message: 'Missing details — name, email, password and mobile number required' })

    // validate phone — must be 10 digits
    if (!/^[6-9]\d{9}$/.test(phone))
      return res.json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email))
      return res.json({ success: false, message: 'Please enter a valid email' })

    if (password.length < 8)
      return res.json({ success: false, message: 'Password must be at least 8 characters' })

    const existing = await userModel.findOne({ email })
    if (existing)
      return res.json({ success: false, message: 'Account already exists with this email' })

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await new userModel({
      name, email, password: hashedPassword,
      phone: `+91${phone}`,   // store with country code for SMS
      isVerified: false
    }).save()

    await sendOtpToUser(user, 'signup')

    res.json({ success: true, message: `OTP sent to ${email}`, userId: user._id })

  } catch (error) {
    console.error('registerWithOtp error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── LOGIN: verify credentials → send OTP ─────────────────────────────────────
export const sendOtp = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await userModel.findOne({ email })
    if (!user)
      return res.json({ success: false, message: 'User does not exist' })

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch)
      return res.json({ success: false, message: 'Invalid credentials' })

    await sendOtpToUser(user, 'login')

    res.json({ success: true, message: `OTP sent to ${user.email}`, userId: user._id })

  } catch (error) {
    console.error('sendOtp error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── VERIFY OTP — both signup + login ─────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const { userId, otp, purpose } = req.body

    if (!userId || !otp)
      return res.json({ success: false, message: 'userId and OTP required' })

    const record = await otpModel.findOne({ userId })
    if (!record)
      return res.json({ success: false, message: 'OTP expired or not found. Please try again.' })

    if (record.attempts >= 3) {
      await otpModel.deleteMany({ userId })
      if (purpose === 'signup')
        await userModel.findOneAndDelete({ _id: userId, isVerified: false })
      return res.json({ success: false, message: 'Too many incorrect attempts. Please try again.' })
    }

    const isMatch = await bcrypt.compare(otp, record.otpHash)
    if (!isMatch) {
      await otpModel.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } })
      const remaining = 2 - record.attempts
      return res.json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      })
    }

    await otpModel.deleteMany({ userId })

    if (purpose === 'signup')
      await userModel.findByIdAndUpdate(userId, { isVerified: true })

    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET)
    res.json({ success: true, token })

  } catch (error) {
    console.error('verifyOtp error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── RESEND OTP ────────────────────────────────────────────────────────────────
export const resendOtp = async (req, res) => {
  try {
    const { userId, purpose } = req.body
    const user = await userModel.findById(userId).select('name email')
    if (!user)
      return res.json({ success: false, message: 'User not found' })

    await sendOtpToUser(user, purpose || 'login')
    res.json({ success: true, message: 'New OTP sent' })

  } catch (error) {
    console.error('resendOtp error:', error)
    res.json({ success: false, message: error.message })
  }
}
