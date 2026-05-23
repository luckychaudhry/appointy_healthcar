import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import transporter from "../utils/mailer.js";
import { patientCancelEmail } from "../utils/cancelEmailTemplates.js";
import userModel from "../models/userModel.js";

const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await doctorModel.findOne({ email });
    if (!user) return res.json({ success: false, message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.json({ success: false, message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

const appointmentsDoctor = async (req, res) => {
  try {
    const docId = req.user.id;
    const appointments = await appointmentModel.find({ docId });
    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const appointmentCancel = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId } = req.body;

    const appointment = await appointmentModel.findById(appointmentId);

    // null check pehle
    if (!appointment || appointment.docId.toString() !== docId) {
      return res.status(403).json({ success: false, message: "Invalid doctor or appointment" });
    }

    if (appointment.checkedIn) {
      return res.json({ success: false, message: 'Patient check-in ho chuka hai — cancel nahi ho sakta' });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, {
      cancelled: true,
      cancelledBy: 'Doctor'
    });

    const user = await userModel.findById(appointment.userId);
    if (user?.email) {
      const { subject, html } = patientCancelEmail({
        patientName: user.name,
        doctorName: appointment.docData?.name,
        speciality: appointment.docData?.speciality,
        slotDate: appointment.slotDate,
        slotTime: appointment.slotTime,
        wasPaid: appointment.payment,
        amount: appointment.amount,
        cancelledBy: "Doctor"
      });
      transporter.sendMail({
        from: `"Appointy Healthcare" <${process.env.EMAIL_USER}>`,
        to: user.email, subject, html
      })
      .then(() => console.log("✅ Cancel mail sent"))
      .catch(err => console.log("❌ Mail error:", err));
    }

    res.json({ success: true, message: "Appointment Cancelled" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const confirmAppointment = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId } = req.body;

    const appointment = await appointmentModel.findById(appointmentId);

    // ── null check PEHLE — warna baaki checks crash karenge ──
    if (!appointment || appointment.docId.toString() !== docId) {
      return res.status(403).json({ success: false, message: "Invalid doctor or appointment" });
    }

    if (appointment.cancelled) {
      return res.json({ success: false, message: "Cannot confirm a cancelled appointment" });
    }

    // ── video payment check ──
    if (appointment.consultationType === 'video' && !appointment.payment) {
      return res.json({
        success: false,
        message: 'Video consultation ke liye pehle patient ko payment karni hogi'
      });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { status: "confirmed" });
    res.json({ success: true, message: "Appointment Confirmed" });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

const appointmentComplete = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId } = req.body;

    const appointment = await appointmentModel.findById(appointmentId);

    // ── null check PEHLE ──
    if (!appointment || appointment.docId.toString() !== docId) {
      return res.status(403).json({ success: false, message: "Invalid doctor or appointment" });
    }

    // ── video call check ──
    if (appointment.consultationType === 'video' && !appointment.callCompleted) {
      return res.json({
        success: false,
        message: 'Firstly complete the video call, then you can mark appointment as completed'
      });
    }
    // in-person check add karo video check ke baad:
if (appointment.consultationType !== 'video' && !appointment.checkedIn) {
  return res.json({
    success: false,
    message: 'Patient is not checked in yet. Please wait for the patient to check in before marking the appointment as completed.'
  })
}

    await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true });
    res.json({ success: true, message: "Appointment Completed" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markCallCompleted = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      return res.json({ success: false, message: 'appointmentId required' });
    }
    const updated = await appointmentModel.findByIdAndUpdate(
      appointmentId,
      { callCompleted: true },
      { new: true }
    );
    if (!updated) {
      return res.json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, message: 'Call marked complete' });
  } catch (err) {
    console.log('markCallCompleted error:', err);
    res.json({ success: false, message: err.message });
  }
};

const doctorList = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select("-password -email");
    res.json({ success: true, doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const changeAvailability = async (req, res) => {
  try {
    const { docId } = req.body;
    if (!docId) return res.status(400).json({ success: false, message: "Doctor ID missing" });
    const doctor = await doctorModel.findById(docId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
    doctor.available = !doctor.available;
    await doctor.save();
    res.json({ success: true, message: "Availability changed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const doctorProfile = async (req, res) => {
  try {
    const docId = req.user.id;
    const profile = await doctorModel.findById(docId).select("-password");
    res.json({ success: true, profileData: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateDoctorProfile = async (req, res) => {
  try {
    const docId = req.user.id;
    const { fees, address, available, about } = req.body;
    await doctorModel.findByIdAndUpdate(docId, { fees, address, available, about });
    res.json({ success: true, message: "Profile Updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const doctorDashboard = async (req, res) => {
  try {
    const docId = req.user.id;
    const appointments = await appointmentModel.find({ docId });
    let earnings = 0;
    const patientSet = new Set();
    appointments.forEach(a => {
      if (a.isCompleted || a.payment) earnings += a.amount;
      patientSet.add(a.userId.toString());
    });
    const dashData = {
      earnings,
      appointments: appointments.length,
      patients: patientSet.size,
      latestAppointments: appointments.reverse().slice(0, 5),
    };
    res.json({ success: true, dashData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const reassignSlot = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId, newSlotDate, newSlotTime } = req.body;
    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment || appointment.docId.toString() !== docId)
      return res.json({ success: false, message: 'Invalid appointment' });
    const doctor = await doctorModel.findById(docId);
    let slots_booked = doctor.slots_booked;
    if (slots_booked[appointment.slotDate]) {
      slots_booked[appointment.slotDate] = slots_booked[appointment.slotDate]
        .filter(t => t !== appointment.slotTime);
    }
    if (!slots_booked[newSlotDate]) slots_booked[newSlotDate] = [];
    slots_booked[newSlotDate].push(newSlotTime);
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });
    await appointmentModel.findByIdAndUpdate(appointmentId, {
      slotDate: newSlotDate,
      slotTime: newSlotTime,
      status: 'confirmed',
    });
    res.json({ success: true, message: 'Slot reassigned successfully' });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export {
  loginDoctor,
  appointmentsDoctor,
  confirmAppointment,
  reassignSlot,
  appointmentCancel,
  appointmentComplete,
  doctorList,
  changeAvailability,
  doctorProfile,
  updateDoctorProfile,
  doctorDashboard,
  markCallCompleted,
};