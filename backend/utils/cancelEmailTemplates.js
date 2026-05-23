// ─── cancelEmailTemplates.js ──────────────────────────────────────────────────
// Save this as: backend/utils/cancelEmailTemplates.js

const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const formatSlotDate = (slotDate) => {
  if (!slotDate) return "N/A"
  const [d, m, y] = slotDate.split("_")
  return `${String(d).padStart(2,"0")} ${MONTHS[Number(m)] || m} ${y}`
}

// ── Email to PATIENT ──────────────────────────────────────────────────────────
export const patientCancelEmail = ({ patientName, doctorName, speciality, slotDate, slotTime, wasPaid, amount, cancelledBy  }) => ({
  subject: `Appointment Cancelled — Dr. ${doctorName} on ${formatSlotDate(slotDate)}`,
  html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
  .top{background:#EF4444;padding:24px 32px}
  .top h1{color:#fff;margin:0;font-size:20px}
  .top p{color:#fecaca;margin:6px 0 0;font-size:13px}
  .body{padding:28px 32px}
  .info-box{background:#fef2f2;border-left:4px solid #EF4444;border-radius:6px;padding:16px 20px;margin:18px 0}
  .row{display:flex;gap:12px;margin:6px 0;font-size:14px;color:#374151}
  .label{font-weight:bold;min-width:100px;color:#1f2937}
  .refund{background:#f0fdf4;border-left:4px solid #10B981;border-radius:6px;padding:14px 20px;margin:18px 0;font-size:13px;color:#065f46}
  .no-refund{background:#fffbeb;border-left:4px solid #F59E0B;border-radius:6px;padding:14px 20px;margin:18px 0;font-size:13px;color:#92400e}
  .footer{background:#f9f9f9;padding:14px 32px;color:#aaa;font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1>Appointment Cancelled</h1>
    <p>Your appointment has been successfully cancelled</p>
  </div>
  <div class="body">
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment has been cancelled by <strong>${cancelledBy}</strong>. Here are the details:</p>
    <div class="info-box">
      <div class="row"><span class="label">Doctor</span><span>Dr. ${doctorName}</span></div>
      <div class="row"><span class="label">Speciality</span><span>${speciality}</span></div>
      <div class="row"><span class="label">Date</span><span>${formatSlotDate(slotDate)}</span></div>
      <div class="row"><span class="label">Time</span><span>${slotTime}</span></div>
    </div>

    ${wasPaid
      ? `<div class="refund">
           <strong>Refund Information</strong><br/>
           You paid <strong>Rs. ${amount}</strong> for this appointment.<br/>
           Refunds are processed within <strong>5–7 business days</strong> to your original payment method.
           Please contact <a href="mailto:customersupport@appointy.in">customersupport@appointy.in</a> if you have questions.
         </div>`
      : `<div class="no-refund">
           No payment was made for this appointment, so no refund is needed.
         </div>`
    }

    <p style="font-size:13px;color:#6b7280;margin-top:16px">
      You can book a new appointment anytime at
      <a href="https://appointy.in" style="color:#5F6FFF">appointy.in</a>
    </p>
  </div>
  <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
</div>
</body>
</html>`
})

// ── Email to DOCTOR ───────────────────────────────────────────────────────────
export const doctorCancelEmail = ({ doctorName, patientName, slotDate, slotTime, cancelledBy }) => ({
  subject: `Appointment Cancelled — ${patientName} on ${formatSlotDate(slotDate)}`,
  html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
  .top{background:#5F6FFF;padding:24px 32px}
  .top h1{color:#fff;margin:0;font-size:20px}
  .top p{color:#c7d2fe;margin:6px 0 0;font-size:13px}
  .body{padding:28px 32px}
  .info-box{background:#f0f0ff;border-left:4px solid #5F6FFF;border-radius:6px;padding:16px 20px;margin:18px 0}
  .row{display:flex;gap:12px;margin:6px 0;font-size:14px;color:#374151}
  .label{font-weight:bold;min-width:100px;color:#1f2937}
  .slot-free{background:#f0fdf4;border-left:4px solid #10B981;border-radius:6px;padding:12px 18px;margin:18px 0;font-size:13px;color:#065f46}
  .footer{background:#f9f9f9;padding:14px 32px;color:#aaa;font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1>Appointment Cancellation Notice</h1>
    <p>A patient has cancelled their appointment</p>
  </div>
  <div class="body">
    <p>Dear <strong>Dr. ${doctorName}</strong>,</p>
    <p>The following appointment has been cancelled by <strong>${cancelledBy}</strong>:</p>
    <div class="info-box">
      <div class="row"><span class="label">Patient</span><span>${patientName}</span></div>
      <div class="row"><span class="label">Date</span><span>${formatSlotDate(slotDate)}</span></div>
      <div class="row"><span class="label">Time</span><span>${slotTime}</span></div>
    </div>
    <div class="slot-free">
      ✓ This time slot has been automatically freed and is now available for new bookings.
    </div>
    <p style="font-size:13px;color:#6b7280">
      Log in to your Appointy doctor panel to view your updated schedule.
    </p>
  </div>
  <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
</div>
</body>
</html>`
})

export const AdminCancelEmail = ({ patientName, doctorName, speciality, slotDate, slotTime, wasPaid, amount, cancelledBy  }) => ({
  subject: `Appointment Cancelled — Dr. ${doctorName} on ${formatSlotDate(slotDate)}`,
  html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/>
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden}
  .top{background:#EF4444;padding:24px 32px}
  .top h1{color:#fff;margin:0;font-size:20px}
  .top p{color:#fecaca;margin:6px 0 0;font-size:13px}
  .body{padding:28px 32px}
  .info-box{background:#fef2f2;border-left:4px solid #EF4444;border-radius:6px;padding:16px 20px;margin:18px 0}
  .row{display:flex;gap:12px;margin:6px 0;font-size:14px;color:#374151}
  .label{font-weight:bold;min-width:100px;color:#1f2937}
  .refund{background:#f0fdf4;border-left:4px solid #10B981;border-radius:6px;padding:14px 20px;margin:18px 0;font-size:13px;color:#065f46}
  .no-refund{background:#fffbeb;border-left:4px solid #F59E0B;border-radius:6px;padding:14px 20px;margin:18px 0;font-size:13px;color:#92400e}
  .footer{background:#f9f9f9;padding:14px 32px;color:#aaa;font-size:12px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <h1>Appointment Cancelled</h1>
    <p>Your appointment has been successfully cancelled</p>
  </div>
  <div class="body">
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment has been cancelled by <strong>${cancelledBy}</strong>. Here are the details:</p>
    <div class="info-box">
      <div class="row"><span class="label">Doctor</span><span>Dr. ${doctorName}</span></div>
      <div class="row"><span class="label">Speciality</span><span>${speciality}</span></div>
      <div class="row"><span class="label">Date</span><span>${formatSlotDate(slotDate)}</span></div>
      <div class="row"><span class="label">Time</span><span>${slotTime}</span></div>
    </div>

    ${wasPaid
      ? `<div class="refund">
           <strong>Refund Information</strong><br/>
           You paid <strong>Rs. ${amount}</strong> for this appointment.<br/>
           Refunds are processed within <strong>5–7 business days</strong> to your original payment method.
           Please contact <a href="mailto:customersupport@appointy.in">customersupport@appointy.in</a> if you have questions.
         </div>`
      : `<div class="no-refund">
           No payment was made for this appointment, so no refund is needed.
         </div>`
    }

    <p style="font-size:13px;color:#6b7280;margin-top:16px">
      You can book a new appointment anytime at
      <a href="https://appointy.in" style="color:#5F6FFF">appointy.in</a>
    </p>
  </div>
  <div class="footer">© 2026 Appointy Healthcare · appointy.in</div>
</div>
</body>
</html>`
})