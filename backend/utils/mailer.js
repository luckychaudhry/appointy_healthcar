import nodemailer from 'nodemailer'

// Reusable transporter — reads from .env
// Works with Gmail, Outlook, or any SMTP provider
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,     // your email e.g. appointy.noreply@gmail.com
    pass: process.env.EMAIL_PASS      // Gmail App Password (not your login password)
  }
})

// Verify connection on startup (optional — remove in prod if noisy)
transporter.verify((error) => {
  if (error) {
    console.error('Mailer not ready:', error.message)
  } else {
    console.log('Mailer ready')
  }
})

export default transporter
