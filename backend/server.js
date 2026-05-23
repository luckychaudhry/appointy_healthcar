// ─────────────────────────────────────────────────────────────────────────────
// This is your updated server.js (or app.js / index.js — whatever your entry
// point is). Only two changes from your existing file are needed:
//
//   1. Import scheduleReminders at the top
//   2. Call scheduleReminders() after mongoose connects
//
// Everything else stays exactly the same.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import connectDB from './config/mongodb.js'
import connectCloudinary from './config/cloudinary.js'
import adminRouter from './routes/adminRoute.js'
import doctorRouter from './routes/doctorRoute.js'
import userRouter from './routes/userRoute.js'
import aiRouter from './routes/aiRoute.js'
import { createServer } from 'http'
import { Server } from 'socket.io'
// ── NEW: import reminder scheduler ──────────────────────────────────────────
import scheduleReminders from './jobs/reminderJob.js'
import prescriptionRouter      from './routes/prescriptionRoute.js'
import scheduleMedicineReminders from './jobs/medicineReminderJob.js'
import reportRouter from './routes/reportAnalyzerRoute.js'
// Routes mein:

import fetch from "node-fetch";
import analyticsRouter from './routes/analyticsRoute.js'
import reviewRouter from './routes/reviewRoute.js'

 
// inside connectDB().then(() => { ... })

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})
const PORT = process.env.PORT || 4000
 
connectCloudinary();
// Middlewares
app.use(express.json())
app.use(cors())

// Routes
app.use('/api/admin',  adminRouter)
app.use('/api/doctor', doctorRouter)
app.use('/api/user',   userRouter)
app.use('/api/ai',     aiRouter)
app.use('/api/report', reportRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/review', reviewRouter)


app.post("/api/video/token", async (req, res) => {
  try {
    const { appointmentId, role } = req.body;

    const response = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DAILY_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          room_name: "appointy-room",
          is_owner: role === "doctor",
          exp: Math.floor(Date.now() / 1000) + 1800,
          user_name: appointmentId
        }
      })
    });

    const data = await response.json();

    res.json({ success: true, token: data.token });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.get('/', (req, res) => res.send('Appointy API running'))

// Active calls track karo — { appointmentId: socketId }
const activeCalls = {}

io.on('connection', (socket) => {
  
  // Doctor call start kare
  socket.on('doctor:startCall', ({ appointmentId, doctorName }) => {
    activeCalls[appointmentId] = socket.id
    // Sab connected users ko notify karo
    io.emit('call:incoming', { appointmentId, doctorName })
    console.log(`Call started: ${appointmentId}`)
  })

  // Doctor call end kare
  socket.on('doctor:endCall', ({ appointmentId }) => {
    delete activeCalls[appointmentId]
    io.emit('call:ended', { appointmentId })
  })

  // Patient join kare
  socket.on('patient:joined', ({ appointmentId }) => {
    io.emit('call:patientJoined', { appointmentId })
  })

  socket.on('disconnect', () => {
    // Agar doctor disconnect ho toh call end karo
    const apptId = Object.keys(activeCalls).find(k => activeCalls[k] === socket.id)
    if (apptId) {
      delete activeCalls[apptId]
      io.emit('call:ended', { appointmentId: apptId })
    }
  })
})

// Connect DB + start server
connectDB().then(() => {
  // ── NEW: start cron job after DB is ready ───────────────────────────────
  scheduleReminders()
  app.use('/api/prescription', prescriptionRouter)  // moved inside connectDB to ensure DB connection before handling prescriptions
scheduleMedicineReminders()  

 // PEHLE


// BAAD MEIN  
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
})
