import validator from 'validator'
import bcrypt from 'bcrypt'
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import jwt from "jsonwebtoken";
import {v2 as cloudinary} from 'cloudinary'  
import razorpay from 'razorpay';
import transporter from '../utils/mailer.js';
import { patientCancelEmail, doctorCancelEmail } from '../utils/cancelEmailTemplates.js';


// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;

        // checking for all data to register user
        if (!name || !email || !password) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(email)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (password.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const { userId } = req.body
        const userData = await userModel.findById(userId).select('-password')

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const { userId, name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: JSON.parse(address), dob, gender })

        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const { userId, docId, slotDate, slotTime, consultationType } = req.body
        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        let slots_booked = docData.slots_booked
            // 🔥 Prevent booking past time slots
const [day, month, year] = slotDate.split('_')

const [time, modifier] = slotTime.split(' ')
let [hours, minutes] = time.split(':')

hours = parseInt(hours)
minutes = parseInt(minutes)

if (modifier === 'PM' && hours !== 12) {
  hours += 12
}

if (modifier === 'AM' && hours === 12) {
  hours = 0
}

const appointmentDateTime = new Date(
  year,
  month - 1,
  day,
  hours,
  minutes
)


if (appointmentDateTime <= new Date()) {
  return res.json({
    success: false,
    message: "Cannot book past time slot"
  })
}
        // checking for slot availablity 
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot Not Available' })
            }
            else {
                slots_booked[slotDate].push(slotTime)
            }
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        const userData = await userModel.findById(userId).select("-password")

        delete docData.slots_booked

        const appointmentData = {
            userId,
            docId,
            userData,
            docData,
            amount: docData.fees,
            slotTime,
            slotDate,
            date: Date.now(),
            consultationType: consultationType || 'in-person'
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        // save new slots data in docData
        await doctorModel.findByIdAndUpdate(docId, { slots_booked })

        res.json({ success: true, message: 'Appointment Booked' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
  try {

    const { userId, appointmentId } = req.body
    const appointmentData = await appointmentModel.findById(appointmentId)
     if (appointmentData.checkedIn) {
      return res.json({ success: false, message: 'Appointment already checked in Cannot be cancelled' })
    }
    // verify appointment user
    if (appointmentData.userId !== userId) {
      return res.json({ success: false, message: 'Unauthorized action' })
    }
    if (appointmentData.cancelled) {
      return res.json({ success: false, message: 'Appointment already cancelled' })
    }

    if (appointmentData.isCompleted) {
      return res.json({ success: false, message: 'Completed appointments cannot be cancelled' })
    }

    // ── 1 ghante pehle cancel nahi ho sakta ──────────────────────────────
    const MONTHS_C = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const [cd, cm, cy] = appointmentData.slotDate.split('_')

    const [timePart, period] = (appointmentData.slotTime || '').split(' ')
    const [hh, mm]           = (timePart || '0:0').split(':')
    let apptHours            = parseInt(hh) || 0
    if (period === 'PM' && apptHours !== 12) apptHours += 12
    if (period === 'AM' && apptHours === 12) apptHours  = 0

    const apptDateTime = new Date(parseInt(cy), parseInt(cm) - 1, parseInt(cd), apptHours, parseInt(mm) || 0, 0, 0)
    const nowTime      = new Date()
    const diffMins     = Math.floor((apptDateTime - nowTime) / 60000)

    if (diffMins <= 0) {
      return res.json({
        success: false,
        message: 'Appointment time has already passed and cannot be cancelled.'
      })
    }

    if (diffMins <= 60) {
      return res.json({
        success: false,
        message: `Cancellation is not allowed within 1 hour of your appointment. Only ${diffMins} minute${diffMins !== 1 ? 's' : ''} remaining until ${appointmentData.slotTime}. Please contact the clinic directly.`
      })
    }

    // cancel appointment
    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true, cancelledBy: 'User' })


    // release doctor slot
    const { docId, slotDate, slotTime } = appointmentData
    const doctorData = await doctorModel.findById(docId)

    let slots_booked = doctorData.slots_booked
    slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)

    await doctorModel.findByIdAndUpdate(docId, { slots_booked })

    // ───────── EMAIL LOGIC ─────────

    const patientEmail = appointmentData.userData?.email
    const doctorEmail  = doctorData?.email

    const patientName = appointmentData.userData?.name || "Patient"
    const doctorName  = appointmentData.docData?.name || "Doctor"
    const speciality  = appointmentData.docData?.speciality || ""

    const wasPaid = appointmentData.payment
    const amount  = appointmentData.amount

    // 📧 Patient Email
    if (patientEmail) {
      const { subject, html } = patientCancelEmail({
        patientName,
        doctorName,
        speciality,
        slotDate,
        slotTime,
        wasPaid,
        amount,
        cancelledBy: "Patient"
      })

      transporter.sendMail({
        from: `"Appointy Healthcare" <${process.env.EMAIL_USER}>`,
        to: patientEmail,
        subject,
        html
      }).catch(err => console.log("Patient mail error:", err.message))
    }

    // 📧 Doctor Email
    if (doctorEmail) {
      const { subject, html } = doctorCancelEmail({
        doctorName,
        patientName,
        slotDate,
        slotTime,
        cancelledBy: "Patient"
      })

      transporter.sendMail({
        from: `"Appointy Healthcare" <${process.env.EMAIL_USER}>`,
        to: doctorEmail,
        subject,
        html
      }).catch(err => console.log("Doctor mail error:", err.message))
    }

    res.json({ success: true, message: 'Appointment Cancelled' })

  } catch (error) {
    console.log(error)
    res.json({ success: false, message: error.message })
  }
}
// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const userId = req.body.userId || req.user?.id || req.userId

        const appointments = await appointmentModel.find({ userId })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const { appointmentId } = req.body
        const appointmentData = await appointmentModel.findById(appointmentId)
        // ❌ block expired payment
const [d, m, y] = appointmentData.slotDate.split('_')

let [hour, minute] = appointmentData.slotTime.split(':')
minute = minute.split(' ')[0]
let ampm = appointmentData.slotTime.includes('PM')

hour = parseInt(hour)
if (ampm && hour !== 12) hour += 12
if (!ampm && hour === 12) hour = 0

const appointmentTime = new Date(y, m - 1, d, hour, minute)

if (appointmentTime - new Date() <= 0) {
  return res.json({
    success: false,
    message: "Cannot pay for expired appointment"
  })
}
        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        // creating options for razorpay payment
        const options = {
            amount: appointmentData.amount * 100,
            currency: process.env.CURRENCY,
            receipt: appointmentId,
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({ success: true, order })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

        if (orderInfo.status === 'paid') {
            await appointmentModel.findByIdAndUpdate(orderInfo.receipt, {
                payment:             true,
                razorpay_payment_id: razorpay_payment_id || '',
                razorpay_order_id:   razorpay_order_id   || '',
                razorpay_signature:  razorpay_signature  || '',
            })
            res.json({ success: true, message: "Payment Successful" })
        }
        else {
            res.json({ success: false, message: 'Payment Failed' })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


// GET /api/user/qr-token/:appointmentId
// Returns a signed JWT that encodes the appointment identity
const generateQrToken = async (req, res) => {
  try {
    const { appointmentId } = req.params
    const { userId } = req.body   // set by authUser middleware
 
    const appointment = await appointmentModel.findById(appointmentId).lean()
    if (!appointment) return res.json({ success: false, message: 'Appointment not found' })
    if (appointment.userId.toString() !== userId) {
      return res.json({ success: false, message: 'Unauthorized' })
    }
 
    // Sign a short-lived token — expires in 24 hours
    const qrToken = jwt.sign(
      {
        appointmentId : appointment._id.toString(),
        shortId       : appointment._id.toString().slice(-8).toUpperCase(),
        userId        : userId,
        type          : 'qr-checkin',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )
 
    res.json({ success: true, qrToken })
  } catch (err) {
    res.json({ success: false, message: err.message })
  }
}
 
export {registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay,generateQrToken}