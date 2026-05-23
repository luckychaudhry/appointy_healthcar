// ─────────────────────────────────────────────────────────────────────────────
// Manual test script — run this ONCE from your backend folder to verify
// that emails and SMS are actually being sent before waiting for the cron.
//
// Usage:
//   node testReminder.js
//
// What it does:
//   - Connects to your MongoDB
//   - Runs the reminder job immediately (same code the cron uses)
//   - Logs what it sent / skipped
//   - Exits when done
//
// Tip: To test with a real appointment, book one in the app for tomorrow's
// date, then run this script.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import mongoose from 'mongoose'
import { sendReminders } from './jobs/reminderJob.js'

const run = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected. Running reminder job now...\n')

    await sendReminders()

    console.log('\nDone. Check your email and phone.')
  } catch (err) {
    console.error('Test failed:', err.message)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

run()
