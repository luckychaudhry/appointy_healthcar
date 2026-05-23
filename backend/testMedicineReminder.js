import 'dotenv/config'
import mongoose from 'mongoose'
import { sendMedicineReminders } from './jobs/medicineReminderJob.js'

const run = async () => {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connected!\n')

    // Quick .env check
    console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET ❌')
    console.log('TWILIO_SID:', process.env.TWILIO_ACCOUNT_SID ? 'SET ✓' : 'NOT SET ❌')
    console.log('')

    await sendMedicineReminders()

    console.log('\nDone. Check patient email and phone.')
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

run()
