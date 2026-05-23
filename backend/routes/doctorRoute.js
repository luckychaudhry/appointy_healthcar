import express from 'express';
import { loginDoctor, appointmentsDoctor, appointmentCancel, doctorList,  appointmentComplete, doctorDashboard, doctorProfile, updateDoctorProfile, changeAvailability,confirmAppointment,reassignSlot } from '../controllers/doctorController.js';
import authDoctor from '../middlewares/authDoctor.js';
import { markCallCompleted } from '../controllers/doctorController.js';
const doctorRouter = express.Router();

doctorRouter.post("/login", loginDoctor)
doctorRouter.post("/cancel-appointment", authDoctor, appointmentCancel)
doctorRouter.get("/appointments", authDoctor, appointmentsDoctor)
doctorRouter.get("/list", doctorList)
doctorRouter.post("/change-availability", authDoctor, changeAvailability)
doctorRouter.post("/complete-appointment", authDoctor, appointmentComplete)
doctorRouter.get("/dashboard", authDoctor, doctorDashboard)
doctorRouter.get("/profile", authDoctor, doctorProfile)
doctorRouter.post("/update-profile", authDoctor, updateDoctorProfile)
doctorRouter.post("/reassign-slot", authDoctor, reassignSlot)
doctorRouter.post('/mark-call-completed', authDoctor, markCallCompleted)
doctorRouter.post("/confirm", authDoctor, confirmAppointment);
export default doctorRouter;