import express from 'express'
import { addDoctor, adminDashboard, allDoctors, appointmentCancel, appointmentsAdmin, loginAdmin,removeDoctor} from '../controllers/adminController.js'
import upload from '../middlewares/multer.js'
import authAdmin from '../middlewares/authAdmin.js';
import { changeAvailability } from '../controllers/doctorController.js';
import { getAppointmentByShortId } from '../controllers/adminController.js'
import { verifyQrToken } from '../controllers/adminController.js'
import { markCheckedIn } from '../controllers/adminController.js'
const adminRouter = express.Router();
adminRouter.post('/verify-qr', authAdmin, verifyQrToken)
adminRouter.get('/appointment/short/:shortId', authAdmin, getAppointmentByShortId)
adminRouter.post("/login", loginAdmin)
adminRouter.post("/add-doctor", authAdmin, upload.single('image'), addDoctor)
adminRouter.get("/all-doctors", authAdmin, allDoctors)
adminRouter.post("/change-availability", authAdmin, changeAvailability)
adminRouter.get("/appointments", authAdmin, appointmentsAdmin)
adminRouter.post("/cancel-appointment", authAdmin, appointmentCancel)
adminRouter.get("/dashboard", authAdmin, adminDashboard)
adminRouter.post('/remove-doctor', authAdmin, removeDoctor);
adminRouter.post('/checkin', authAdmin, markCheckedIn)


export default adminRouter;
