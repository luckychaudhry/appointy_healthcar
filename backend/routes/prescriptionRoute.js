import express from 'express'
import {
  addPrescription,
  getPrescription,
  updatePrescription,
  deletePrescription,
  getPatientPrescriptions,
  downloadPrescriptionPDF,
} from '../controllers/prescriptionController.js'
import authDoctor from '../middlewares/authDoctor.js'
import authUser   from '../middlewares/authUser.js'
import jwt        from 'jsonwebtoken'

const prescriptionRouter = express.Router()

// ── Flexible middleware: accepts BOTH patient token AND doctor dToken ──────────
// Doctor panel bhejta hai { dToken }, patient panel bhejta hai { token }
const authAny = (req, res, next) => {
  // Try patient token first
  const token  = req.headers['token']
  const dToken = req.headers['dtoken']

  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET) 
      return next()
    } catch (e) { /* try dToken below */ }
  }

  if (dToken) {
    try {
      const decoded = jwt.verify(dToken, process.env.JWT_SECRET)
      req.user = { id: decoded.id }
      return next()
    } catch (e) { /* fall through */ }
  }

  return res.status(401).json({ success: false, message: 'Not Authorized' })
}

// ── Doctor routes ─────────────────────────────────────────────────────────────
prescriptionRouter.post('/add',                         authDoctor, addPrescription)
prescriptionRouter.get('/appointment/:appointmentId',   authAny,    getPrescription)  // patient + doctor dono
prescriptionRouter.put('/update/:prescriptionId',       authDoctor, updatePrescription)
prescriptionRouter.delete('/delete/:prescriptionId',    authDoctor, deletePrescription)

// ── Patient routes ────────────────────────────────────────────────────────────
prescriptionRouter.post('/my-prescriptions',            authUser,   getPatientPrescriptions)
prescriptionRouter.get('/download/:appointmentId',      authUser,   downloadPrescriptionPDF)

export default prescriptionRouter

// ── Add to server.js ─────────────────────────────────────────────────────────
// import prescriptionRouter from './routes/prescriptionRoute.js'
// app.use('/api/prescription', prescriptionRouter)
