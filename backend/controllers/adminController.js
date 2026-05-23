import jwt from "jsonwebtoken";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import bcrypt from "bcrypt";
import validator from "validator";
import { v2 as cloudinary } from "cloudinary";
import userModel from "../models/userModel.js"
import transporter from "../utils/mailer.js";
import { AdminCancelEmail } from "../utils/cancelEmailTemplates.js";
// API for admin login
const loginAdmin = async (req, res) => {
    try {

        const { email, password } = req.body

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign(email + password, process.env.JWT_SECRET)
            res.json({ success: true, token })
        } else {
            res.json({ success: false, message: "Invalid credentials" })
        }

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API for adding Doctor
const addDoctor = async (req, res) => {
  try {
    const { name, email, password, speciality, degree, experience, about, fees, address } = req.body;
    const imageFile = req.file;

    if (!name || !email || !password || !speciality || !degree || !experience || !about || !fees || !address) {
      return res.status(400).json({ success: false, message: "Missing Details" });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Please enter a strong password" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image", transformation: [
    {
      width: 400,
      height: 400,
      crop: "fill",        // square crop
      gravity: "face",     // face ko center mein rakhe
      quality: "auto",
      fetch_format: "auto"
    }
  ]  });
    const imageUrl = imageUpload.secure_url;

    const doctorData = {
      name,
      email,
      image: imageUrl,
      password: hashedPassword,
      speciality,
      degree,
      experience,
      about,
      fees,
      address: JSON.parse(address),
      date: Date.now()
    };

    const newDoctor = new doctorModel(doctorData);
    await newDoctor.save();

    res.status(200).json({ success: true, message: "Doctor Added" });

  } catch (error) {
    console.error("Error adding doctor:", error);
    res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

// API for appointment cancellation
const appointmentCancel = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)

        
     await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })
      if (appointmentData.checkedIn) {
      return res.json({ success: false, message: 'Patient check-in cannot be cancelled now' })
    }
        // releasing doctor slot 
        const { docId, slotDate, slotTime } = appointmentData
         
        const doctorData = await doctorModel.findById(docId)

        let slots_booked = doctorData.slots_booked

        slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        const patientEmail = appointmentData.userData?.email
        
    const doctorEmail  = doctorData?.email

    const patientName = appointmentData.userData?.name || "Patient"
    const doctorName  = appointmentData.docData?.name || "Doctor"
    const speciality  = appointmentData.docData?.speciality || ""

    const wasPaid = appointmentData.payment
    const amount  = appointmentData.amount
         if (patientEmail) {
          const { subject, html } = AdminCancelEmail({
            patientName,
            doctorName,
            speciality,
            slotDate,
            slotTime,
            wasPaid,
            amount,
            cancelledBy: "Admin"
          })
    
          transporter.sendMail({
            from: `"Appointy Healthcare" <${process.env.EMAIL_USER}>`,
            to: patientEmail,
            subject,
            html
          }).catch(err => console.log("Patient mail error:", err.message))
        }

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
     
}

const allDoctors = async (req, res) => {
    try {

        const doctors = await doctorModel.find({}).select('-password')
        res.json({ success: true, doctors })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get all appointments list
const appointmentsAdmin = async (req, res) => {
    try {

        const appointments = await appointmentModel.find({})
        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to get dashboard data for admin panel
const adminDashboard = async (req, res) => {
    try {

        const doctors = await doctorModel.find({})
        const users = await userModel.find({})
        const appointments = await appointmentModel.find({})

        const dashData = {
            doctors: doctors.length,
            appointments: appointments.length,
            patients: users.length,
            latestAppointments: appointments.reverse().slice(0,5)
        }

        res.json({ success: true, dashData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}
const removeDoctor = async (req, res) => {
  try {
    const { docId } = req.body;

    // 🔥 CHECK: doctor ke appointments hai ya nahi
    const appointments = await appointmentModel.find({ docId });

    if (appointments.length > 0) {
      return res.json({
        success: false,
        message: "Doctor has active appointments, cannot remove"
      });
    }

    // ✅ safe delete
    await doctorModel.findByIdAndDelete(docId);

    res.json({ success: true, message: "Doctor Removed" });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


 
 
// GET /api/admin/appointment/short/:shortId
// shortId = last 8 chars of _id (case-insensitive)
const getAppointmentByShortId = async (req, res) => {
  try {
    const shortId = req.params.shortId.toLowerCase()

    // populate nahi — data already userData/docData mein stored hai
    const appointments = await appointmentModel.find().lean()

    const appointment = appointments.find(a =>
      a._id.toString().slice(-8).toLowerCase() === shortId
    )

    if (!appointment) {
      return res.json({ success: false, message: 'Appointment not found with this ID. Please check the ID and try again.' })
    }

    res.json({ success: true, appointment })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
}
 
const verifyQrToken = async (req, res) => {
  try {
    const { qrToken } = req.body
    let decoded
    try {
      decoded = jwt.verify(qrToken, process.env.JWT_SECRET)
    } catch (e) {
      return res.json({ success: false, message: 'Invalid or expired QR code. Please ask the patient to generate a new one.' })
    }
 
    if (decoded.type !== 'qr-checkin')
      return res.json({ success: false, message: 'Invalid QR type' })
 
    const appointment = await appointmentModel.findById(decoded.appointmentId).lean()
    if (!appointment)
      return res.json({ success: false, message: 'Appointment not found ' })
 
    res.json({ success: true, appointment })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
}
 const markCheckedIn = async (req, res) => {
  try {
    const { appointmentId } = req.body
    await appointmentModel.findByIdAndUpdate(appointmentId, { checkedIn: true, checkinTime: Date.now() })
    res.json({ success: true, message: 'Checked in successfully' })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
}
export {loginAdmin, addDoctor, allDoctors, appointmentsAdmin, appointmentCancel, adminDashboard, removeDoctor,getAppointmentByShortId, verifyQrToken, markCheckedIn}