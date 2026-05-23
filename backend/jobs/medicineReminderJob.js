import 'dotenv/config'
import cron from 'node-cron'
import twilio from 'twilio'
import prescriptionModel from '../models/prescriptionModel.js'
import transporter from '../utils/mailer.js'

// ─── Twilio client ────────────────────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

// ─── Group prescriptions by patient for one combined email ───────────────────
const groupByPatient = (prescriptions) => {
  const map = {}
  prescriptions.forEach(p => {
    const key = p.patientEmail || p.patientPhone
    if (!map[key]) {
      map[key] = {
        patientName:  p.patientName,
        patientEmail: p.patientEmail,
        patientPhone: p.patientPhone,
        doctorName:   p.doctorName,
        medicines:    []
      }
    }
    map[key].medicines.push({
      name:      p.medicineName,
      dosage:    p.dosage,
      frequency: p.frequency,
      timing:    p.timing,
      daysLeft:  Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    })
  })
  return Object.values(map)
}

// ─── Email template ───────────────────────────────────────────────────────────
const reminderEmailHTML = ({ patientName, doctorName, medicines }) => {
  const rows = medicines.map(m => `
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:10px 16px;font-weight:bold;color:#1f2937">${m.name} ${m.dosage}</td>
      <td style="padding:10px 16px;color:#374151">${m.frequency}</td>
      <td style="padding:10px 16px;color:#374151">${m.timing || '—'}</td>
      <td style="padding:10px 16px;color:#6b7280;font-size:12px">${m.daysLeft} day${m.daysLeft !== 1 ? 's' : ''} left</td>
    </tr>`).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
  .hdr{background:#5F6FFF;padding:24px 32px}
  .hdr h1{color:#fff;margin:0;font-size:20px}
  .hdr p{color:#c7d2fe;margin:6px 0 0;font-size:13px}
  .body{padding:28px 32px}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
  th{background:#f0f0ff;color:#3C3489;padding:10px 16px;text-align:left;font-size:12px;font-weight:600}
  .tip{background:#f0fdf4;border-left:4px solid #10B981;padding:12px 18px;margin-top:20px;font-size:13px;color:#065f46;border-radius:0}
  .footer{background:#f9f9f9;padding:14px 32px;color:#aaa;font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>Medicine reminder</h1>
    <p>Prescribed by Dr. ${doctorName}</p>
  </div>
  <div class="body">
    <p>Hi <strong>${patientName}</strong>, here are your medicines for today:</p>
    <table>
      <thead><tr>
        <th>Medicine</th><th>Frequency</th><th>Timing</th><th>Duration</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="tip">Take medicines as prescribed. Do not skip doses. Contact your doctor if you experience side effects.</div>
  </div>
  <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
</div>
</body>
</html>`
}

// ─── SMS text (short, 1 credit) ───────────────────────────────────────────────
const reminderSMS = ({ patientName, medicines }) => {
  const list = medicines.map(m => `${m.name} ${m.dosage} (${m.frequency})`).join(', ')
  return `Hi ${patientName}, medicines today: ${list}. - Appointy`
}

// ─── Core function: send reminders for today ──────────────────────────────────
export const sendMedicineReminders = async () => {
  try {
    const today    = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Find active prescriptions whose course hasn't ended yet + not yet sent today
    const prescriptions = await prescriptionModel.find({
      isActive:     true,
      reminderSent: false,
      endDate:      { $gte: today }
    })

    if (!prescriptions.length) {
      console.log('[MedReminder] No active prescriptions today.')
      return
    }

    console.log(`[MedReminder] Sending reminders for ${prescriptions.length} prescription(s)...`)

    // Group by patient so one patient gets 1 email (even with multiple medicines)
    const patients = groupByPatient(prescriptions)

    const jobs = patients.map(async (patient) => {
      const tasks = []

      // Email
      if (patient.patientEmail) {
        tasks.push(
          transporter.sendMail({
            from:    `"Appointy" <${process.env.EMAIL_USER}>`,
            to:      patient.patientEmail,
            subject: `Medicine reminder — ${new Date().toLocaleDateString('en-IN')}`,
            html:    reminderEmailHTML(patient)
          })
          .then(() => console.log(`[MedReminder] Email → ${patient.patientEmail}`))
          .catch(e => console.error(`[MedReminder] Email failed → ${patient.patientEmail}:`, e.message))
        )
      }

      // SMS
      const rawPhone   = patient.patientPhone?.replace(/[\s\-\(\)]/g, '')
      const validPhone = rawPhone && /^\+?[6-9]\d{9,13}$/.test(rawPhone)
      if (validPhone) {
        const e164 = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`
        tasks.push(
          twilioClient.messages.create({
            body: reminderSMS(patient),
            from: process.env.TWILIO_PHONE_NUMBER,
            to:   e164
          })
          .then(m => console.log(`[MedReminder] SMS → ${e164} (${m.sid})`))
          .catch(e => console.error(`[MedReminder] SMS failed → ${e164}:`, e.message))
        )
      }

      await Promise.all(tasks)
    })

    await Promise.all(jobs)

    // Mark all sent prescriptions as reminderSent = true
    const ids = prescriptions.map(p => p._id)
    await prescriptionModel.updateMany({ _id: { $in: ids } }, { reminderSent: true })

    console.log(`[MedReminder] Done — ${patients.length} patient(s) notified.`)

  } catch (error) {
    console.error('[MedReminder] Job error:', error.message)
  }
}

// ─── Reset reminderSent at midnight so next day's reminders go out ────────────
const resetReminderFlags = async () => {
  try {
    const result = await prescriptionModel.updateMany(
      { isActive: true, reminderSent: true },
      { reminderSent: false }
    )
    console.log(`[MedReminder] Reset ${result.modifiedCount} reminder flag(s) for tomorrow.`)
  } catch (error) {
    console.error('[MedReminder] Reset error:', error.message)
  }
}

// ─── Schedule both jobs ───────────────────────────────────────────────────────
const scheduleMedicineReminders = () => {
  // Send reminders every day at 9:00 AM IST
  cron.schedule('0 9 * * *', async () => {
    console.log('[MedReminder] 9 AM cron triggered:', new Date().toISOString())
    await sendMedicineReminders()
  }, { timezone: 'Asia/Kolkata' })

  // Reset flags every day at midnight IST
  cron.schedule('0 0 * * *', async () => {
    console.log('[MedReminder] Midnight reset triggered:', new Date().toISOString())
    await resetReminderFlags()
  }, { timezone: 'Asia/Kolkata' })

  console.log('[MedReminder] Scheduled — reminders at 9 AM, reset at midnight (IST)')
}

export default scheduleMedicineReminders
