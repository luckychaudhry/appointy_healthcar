import cron from 'node-cron'
import twilio from 'twilio'
import appointmentModel from '../models/appointmentModel.js'
import transporter from '../utils/mailer.js'

// ─── Twilio client ────────────────────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// ─── Email template ───────────────────────────────────────────────────────────
const reminderEmailHTML = ({ patientName, doctorName, speciality, slotDate, slotTime, address }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #5F6FFF; padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .header p  { color: #c8ccff; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 28px 32px; }
    .info-box { background: #f0f0ff; border-left: 4px solid #5F6FFF; border-radius: 6px;
                padding: 16px 20px; margin: 20px 0; }
    .info-row { display: flex; gap: 12px; margin: 8px 0; font-size: 14px; color: #374151; }
    .info-label { font-weight: bold; min-width: 90px; color: #1f2937; }
    .tip { font-size: 13px; color: #6b7280; margin-top: 20px; }
    .footer { background: #f9f9f9; padding: 16px 32px; color: #aaa; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointy — Appointment Reminder</h1>
      <p>Your appointment is tomorrow</p>
    </div>
    <div class="body">
      <p>Hi <strong>${patientName}</strong>,</p>
      <p>This is a friendly reminder that you have an upcoming appointment:</p>
      <div class="info-box">
        <div class="info-row"><span class="info-label">Doctor</span><span>Dr. ${doctorName}</span></div>
        <div class="info-row"><span class="info-label">Speciality</span><span>${speciality}</span></div>
        <div class="info-row"><span class="info-label">Date</span><span>${slotDate}</span></div>
        <div class="info-row"><span class="info-label">Time</span><span>${slotTime}</span></div>
        <div class="info-row"><span class="info-label">Address</span><span>${address}</span></div>
      </div>
      <p class="tip">Please arrive 10 minutes early. Carry a valid ID and any previous medical reports.</p>
      <p class="tip">To cancel, log in to your Appointy account.</p>
    </div>
    <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
  </div>
</body>
</html>`

// ─── SMS template (160 chars max for 1 SMS credit) ───────────────────────────
const reminderSMS = ({ patientName, doctorName, slotDate, slotTime }) =>
  `Hi ${patientName}, reminder: appointment with Dr. ${doctorName} tomorrow at ${slotTime} on ${slotDate}. - Appointy`

// ─── Format slotDate from "12_04_2026" → "12 Apr 2026" ───────────────────────
const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatDate = (slotDate) => {
  const [day, month, year] = slotDate.split('_')
  return `${day} ${months[Number(month)]} ${year}`
}

// ─── Core function: find upcoming appointments and send reminders ─────────────
export const sendReminders = async () => {
  try {
    const now   = new Date()
    const start = new Date(now.getTime() + 23 * 60 * 60 * 1000) // 23 hrs from now
    const end   = new Date(now.getTime() + 25 * 60 * 60 * 1000) // 25 hrs from now

    // Build the date string range Appointy stores dates as "DD_MM_YYYY"
    // So we check if the appointment's slotDate matches tomorrow's date
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const day   = String(tomorrow.getDate()).padStart(2, '0')
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const year  = tomorrow.getFullYear()
    const tomorrowSlot = `${day}_${month}_${year}`

    // Find all non-cancelled, unpaid or paid appointments for tomorrow
    const appointments = await appointmentModel.find({
  cancelled: false,
  $or: [
    { slotDate: tomorrowSlot },                // 27_04_2026
    { slotDate: `${Number(day)}_${Number(month)}_${year}` } // 27_4_2026
  ]
});

    if (!appointments.length) {
      console.log(`[Reminders] ${new Date().toISOString()} — no appointments tomorrow, skipping.`)
      return
    }

    console.log(`[Reminders] ${new Date().toISOString()} — sending ${appointments.length} reminder(s)...`)

    // Send reminders in parallel for each appointment
    const results = await Promise.allSettled(
      appointments.map(appt => sendSingleReminder(appt))
    )

    // Log summary
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed    = results.filter(r => r.status === 'rejected').length
    console.log(`[Reminders] Done — ${succeeded} sent, ${failed} failed.`)

    // Log individual failures for debugging
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[Reminders] Failed for appointment ${appointments[i]._id}:`, r.reason?.message)
      }
    })

  } catch (error) {
    console.error('[Reminders] Job error:', error.message)
  }
}

// ─── Send one reminder: email + SMS ──────────────────────────────────────────
const sendSingleReminder = async (appt) => {
  const patientName = appt.userData?.name   || 'Patient'
  const patientEmail = appt.userData?.email
  const patientPhone = appt.userData?.phone
  const doctorName  = appt.docData?.name    || 'your doctor'
  const speciality  = appt.docData?.speciality || ''
  const slotDate    = formatDate(appt.slotDate)
  const slotTime    = appt.slotTime
  const address     = appt.docData?.address
    ? `${appt.docData.address.line1}, ${appt.docData.address.line2}`
    : 'See your booking details'

  const templateData = { patientName, doctorName, speciality, slotDate, slotTime, address }

  const tasks = []

  // Email reminder
  if (patientEmail) {
    tasks.push(
      transporter.sendMail({
        from: `"Appointy" <${process.env.EMAIL_USER}>`,
        to: patientEmail,
        subject: `Reminder: Appointment with Dr. ${doctorName} tomorrow`,
        html: reminderEmailHTML(templateData)
      }).then(() => console.log(`[Reminders] Email sent → ${patientEmail}`))
        .catch(err => console.error(`[Reminders] Email failed → ${patientEmail}:`, err.message))
    )
  }

  // SMS reminder — only if phone looks valid (10 digits after stripping spaces/dashes)
  const cleanPhone = patientPhone?.replace(/[\s\-\(\)]/g, '')
  const isValidPhone = cleanPhone && /^\+?[1-9]\d{9,14}$/.test(cleanPhone)

  if (isValidPhone) {
    // Ensure E.164 format: +91XXXXXXXXXX for India
    const e164Phone = cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone}`

    tasks.push(
      twilioClient.messages.create({
        body: reminderSMS({ patientName, doctorName, slotDate, slotTime }),
        from: process.env.TWILIO_PHONE_NUMBER,
        to: e164Phone
      }).then(msg => console.log(`[Reminders] SMS sent → ${e164Phone} (SID: ${msg.sid})`))
        .catch(err => console.error(`[Reminders] SMS failed → ${e164Phone}:`, err.message))
    )
  }

  await Promise.all(tasks)
}

// ─── Schedule the cron job ────────────────────────────────────────────────────
// Runs every day at 8:00 PM (IST = UTC+5:30, so 14:30 UTC)
// Cron format: second(opt) minute hour day month weekday
// '0 20 * * *' = daily at 8 PM server time
// If your server is UTC, use '30 14 * * *' to hit 8 PM IST

const scheduleReminders = () => {
  cron.schedule('30 22 * * *', async () => {
    console.log('[Reminders] Cron triggered at', new Date().toISOString())
    await sendReminders()
  }, {
    timezone: 'Asia/Kolkata'   // IST — change to your server timezone if needed
  })

  console.log('[Reminders] Cron job scheduled — runs daily at 8:00 PM IST')
}

export default scheduleReminders
