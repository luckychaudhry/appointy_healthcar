import prescriptionModel from '../models/prescriptionModel.js'
import appointmentModel  from '../models/appointmentModel.js'
import PDFDocument        from 'pdfkit'
import fs                 from 'fs'
import path               from 'path'

// ── ADD prescriptions (doctor, after completing appointment) ──────────────────
export const addPrescription = async (req, res) => {
  try {
    const { appointmentId, medicines } = req.body

    if (!appointmentId || !medicines?.length)
      return res.json({ success: false, message: 'appointmentId and medicines required' })

    const appt = await appointmentModel.findById(appointmentId)
    if (!appt) return res.json({ success: false, message: 'Appointment not found' })

    // Delete old prescriptions for this appointment before saving new ones
    // (so doctor can replace entire prescription in one go)
    await prescriptionModel.deleteMany({ appointmentId })

    const docs = medicines.map(med => {
      const end = new Date()
      end.setDate(end.getDate() + Number(med.durationDays))
      return {
        appointmentId,
        doctorId:     appt.docId,
        userId:       appt.userId,
        medicineName: med.medicineName,
        dosage:       med.dosage,
        frequency:    med.frequency,
        timing:       med.timing || '',
        durationDays: Number(med.durationDays),
        patientName:  appt.userData?.name  || '',
        patientEmail: appt.userData?.email || '',
        patientPhone: appt.userData?.phone || '',
        doctorName:   appt.docData?.name   || '',
        speciality:   appt.docData?.speciality || '',
        startDate:    new Date(),
        endDate:      end,
      }
    })

    await prescriptionModel.insertMany(docs)
    res.json({ success: true, message: `${docs.length} prescription(s) saved` })

  } catch (error) {
    console.error('addPrescription error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── GET prescriptions by appointmentId (doctor view + patient view) ───────────
export const getPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params
    const prescriptions = await prescriptionModel
      .find({ appointmentId, isActive: true })
      .sort({ createdAt: 1 })
    res.json({ success: true, prescriptions })
  } catch (error) {
    console.error('getPrescription error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── UPDATE a single prescription row (doctor edits) ───────────────────────────
export const updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params
    const { medicineName, dosage, frequency, timing, durationDays } = req.body

    if (!medicineName || !dosage)
      return res.json({ success: false, message: 'Medicine name and dosage required' })

    const prescription = await prescriptionModel.findById(prescriptionId)
    if (!prescription)
      return res.json({ success: false, message: 'Prescription not found' })

    // Recalculate endDate based on new durationDays from original startDate
    const end = new Date(prescription.startDate)
    end.setDate(end.getDate() + Number(durationDays))

    await prescriptionModel.findByIdAndUpdate(prescriptionId, {
      medicineName,
      dosage,
      frequency,
      timing,
      durationDays: Number(durationDays),
      endDate:      end,
      reminderSent: false,  // reset so updated reminder goes out today
    })

    res.json({ success: true, message: 'Prescription updated' })
  } catch (error) {
    console.error('updatePrescription error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── DELETE a single prescription row ─────────────────────────────────────────
export const deletePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params
    await prescriptionModel.findByIdAndUpdate(prescriptionId, { isActive: false })
    res.json({ success: true, message: 'Medicine removed' })
  } catch (error) {
    console.error('deletePrescription error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── GET all prescriptions for a patient (My Appointments page) ────────────────
export const getPatientPrescriptions = async (req, res) => {
  try {
    const { userId } = req.body
    const prescriptions = await prescriptionModel
      .find({ userId, isActive: true })
      .sort({ createdAt: -1 })
    res.json({ success: true, prescriptions })
  } catch (error) {
    console.error('getPatientPrescriptions error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── DOWNLOAD prescription as PDF (patient) ────────────────────────────────────
export const downloadPrescriptionPDF = async (req, res) => {
  try {
    const { appointmentId } = req.params

    const prescriptions = await prescriptionModel
      .find({ appointmentId, isActive: true })
      .sort({ createdAt: 1 })

    if (!prescriptions.length)
      return res.status(404).json({ success: false, message: 'No prescription found for this appointment' })

    const appt = await appointmentModel.findById(appointmentId)

    // ── Colors ──────────────────────────────────────────────────────────────
    const PRIMARY  = '#5F6FFF'
    const DARK     = '#1F2937'
    const MUTED    = '#6B7280'
    const LIGHT_BG = '#F3F4F6'
    const WHITE    = '#FFFFFF'
    const GREEN    = '#10B981'

    // ── Ensure output folder exists ──────────────────────────────────────────
    const dir = path.resolve('prescriptions')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `prescription-${appointmentId}.pdf`)

    const doc    = new PDFDocument({ margin: 0, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const W = doc.page.width

    // ── Top bar ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 10).fill(PRIMARY)

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(24).fillColor(PRIMARY).font('Helvetica-Bold')
       .text('APPOINTY', 50, 28)
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('HEALTHCARE', 50, 56)
       .text('Your Health, Our Priority', 50, 68)

    doc.fontSize(9).fillColor(MUTED)
       .text('customersupport@appointy.in', 0, 36, { width: W - 50, align: 'right' })
       .text('+91-90000-90000',             0, 50, { width: W - 50, align: 'right' })

    // Divider
    doc.strokeColor('#E5E7EB').lineWidth(0.5)
       .moveTo(50, 90).lineTo(545, 90).stroke()

    // ── Prescription heading ──────────────────────────────────────────────────
    doc.fontSize(28).fillColor(DARK).font('Helvetica-Bold')
       .text('PRESCRIPTION', 50, 104)

    // Date + Rx number
    const rxNum  = `RX-${appointmentId.toString().slice(-8).toUpperCase()}`
    const rxDate = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })

    doc.fontSize(9).fillColor(MUTED).font('Helvetica').text('Rx Number:', 360, 110)
    doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(rxNum, 440, 110, { width: 100, align: 'right' })
    doc.fontSize(9).fillColor(MUTED).font('Helvetica').text('Date:', 360, 126)
    doc.fontSize(9).fillColor(DARK).font('Helvetica-Bold').text(rxDate, 440, 126, { width: 100, align: 'right' })

    doc.strokeColor('#E5E7EB').lineWidth(0.5)
       .moveTo(50, 165).lineTo(545, 165).stroke()

    // ── Patient + Doctor info ─────────────────────────────────────────────────
    const infoY = 178

    // Patient
    doc.fontSize(9).fillColor(PRIMARY).font('Helvetica-Bold').text('PATIENT', 50, infoY)
    doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
       .text(prescriptions[0].patientName || 'N/A', 50, infoY + 14)
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(prescriptions[0].patientEmail || '', 50, infoY + 29)
       .text(prescriptions[0].patientPhone || '', 50, infoY + 42)

    // Doctor
    doc.fontSize(9).fillColor(PRIMARY).font('Helvetica-Bold').text('PRESCRIBED BY', 310, infoY)
    doc.fontSize(12).fillColor(DARK).font('Helvetica-Bold')
       .text(`Dr. ${prescriptions[0].doctorName}`, 310, infoY + 14)
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(prescriptions[0].speciality || '', 310, infoY + 29)
    if (appt?.slotDate) {
      const [d, m, y] = appt.slotDate.split('_')
      const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      doc.text(`Appointment: ${d} ${MONTHS[Number(m)]} ${y}  ${appt.slotTime || ''}`, 310, infoY + 42)
    }

    doc.strokeColor('#E5E7EB').lineWidth(0.5)
       .moveTo(50, infoY + 68).lineTo(545, infoY + 68).stroke()

    // ── Medicines table ───────────────────────────────────────────────────────
    const tblY = infoY + 80

    // Table header
    doc.rect(50, tblY, 495, 26).fill(PRIMARY)
    const cols = { med: 60, dose: 230, freq: 320, timing: 410, days: 490 }
    doc.fontSize(9).fillColor(WHITE).font('Helvetica-Bold')
       .text('Medicine',  cols.med,   tblY + 8)
       .text('Dosage',    cols.dose,  tblY + 8)
       .text('Frequency', cols.freq,  tblY + 8)
       .text('Timing',    cols.timing,tblY + 8)
       .text('Days',      cols.days,  tblY + 8)

    // Rows
    prescriptions.forEach((p, i) => {
      const rowY  = tblY + 26 + i * 28
      const rowBg = i % 2 === 0 ? WHITE : LIGHT_BG
      doc.rect(50, rowY, 495, 28).fill(rowBg)

      const end      = new Date(p.endDate)
      const daysLeft = Math.max(0, Math.ceil((end - new Date()) / (1000*60*60*24)))
      const daysStr  = `${p.durationDays}d (${daysLeft} left)`

      doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold')
         .text(`${p.medicineName} ${p.dosage}`, cols.med, rowY + 9, { width: 155 })
      doc.fontSize(9).fillColor(DARK).font('Helvetica')
         .text(p.dosage,     cols.dose,   rowY + 10, { width: 80 })
         .text(p.frequency,  cols.freq,   rowY + 10, { width: 85 })
         .text(p.timing||'—',cols.timing, rowY + 10, { width: 75 })
         .text(daysStr,      cols.days,   rowY + 10, { width: 55 })
    })

    const tblBottom = tblY + 26 + prescriptions.length * 28

    // Table border
    doc.rect(50, tblY, 495, 26 + prescriptions.length * 28)
       .strokeColor('#E5E7EB').lineWidth(0.5).stroke()

    // ── Instructions box ──────────────────────────────────────────────────────
    const instrY = tblBottom + 30
    doc.roundedRect(50, instrY, 495, 54, 6)
       .strokeColor('#E5E7EB').lineWidth(0.5).stroke()
    doc.fontSize(9).fillColor(PRIMARY).font('Helvetica-Bold')
       .text('INSTRUCTIONS', 65, instrY + 10)
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text('Take medicines as prescribed. Do not skip doses. Contact your doctor if you experience side effects or allergic reactions. Complete the full course even if you feel better.', 65, instrY + 24, { width: 465 })

    // ── Validity notice ───────────────────────────────────────────────────────
    const validY = instrY + 74
    doc.rect(50, validY, 495, 26).fill('#EEF2FF')
    doc.fontSize(9).fillColor('#3C3489').font('Helvetica-Bold')
       .text('This prescription is valid for 30 days from the date of issue.', 0, validY + 8, { width: W, align: 'center' })

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50
    doc.strokeColor('#E5E7EB').lineWidth(0.5)
       .moveTo(50, footerY).lineTo(545, footerY).stroke()
    doc.fontSize(8).fillColor(MUTED).font('Helvetica')
       .text('This is a computer-generated prescription from Appointy Healthcare.', 50, footerY + 10, { width: 345 })
       .text('Page 1 of 1', 0, footerY + 10, { width: W - 50, align: 'right' })

    doc.rect(0, doc.page.height - 10, W, 10).fill(PRIMARY)

    doc.end()

    stream.on('finish', () => {
      res.setHeader('Content-Type', 'application/pdf')
      res.download(filePath, `Appointy-Prescription-${rxNum}.pdf`, err => {
        if (err) console.error('Download error:', err.message)
      })
    })

    stream.on('error', err => {
      console.error('Stream error:', err)
      res.status(500).json({ success: false, message: 'PDF generation failed' })
    })

  } catch (error) {
    console.error('downloadPrescriptionPDF error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}
