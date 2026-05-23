import reviewModel      from '../models/reviewModel.js'
import appointmentModel from '../models/appointmentModel.js'
import doctorModel      from '../models/doctorModel.js'
import mongoose from 'mongoose'
// ── Helper: recalculate & save average rating on doctor ──────────────────────
const updateDoctorRating = async (doctorId) => {
  const [result] = await reviewModel.aggregate([
    { $match: { 
        doctorId: new mongoose.Types.ObjectId(doctorId), 
        isHidden: false 
    }},
    { $group: {
        _id:          null,
        avgRating:    { $avg: '$rating' },
        totalReviews: { $sum: 1 },
    }}
  ])
  const avgRating    = result ? parseFloat(result.avgRating.toFixed(1)) : 0
  const totalReviews = result ? result.totalReviews : 0
  await doctorModel.findByIdAndUpdate(doctorId, { avgRating, totalReviews })
  return { avgRating, totalReviews }
}

// ── POST /api/review/add ─────────────────────────────────────────────────────
// Patient adds review after completed appointment
export const addReview = async (req, res) => {
  try {
    const { userId }                    = req.body
    const { appointmentId, rating, review } = req.body

    if (!appointmentId || !rating)
      return res.json({ success: false, message: 'appointmentId and rating required' })

    if (rating < 1 || rating > 5)
      return res.json({ success: false, message: 'Rating must be between 1 and 5' })

    // Verify appointment belongs to user and is completed
    const appt = await appointmentModel.findById(appointmentId)
    if (!appt)
      return res.json({ success: false, message: 'Appointment not found' })
    if (appt.userId !== userId)
      return res.json({ success: false, message: 'Unauthorized' })
    if (!appt.isCompleted)
      return res.json({ success: false, message: 'You can only review completed appointments' })
    if (appt.cancelled)
      return res.json({ success: false, message: 'Cancelled appointments cannot be reviewed' })

    // Check already reviewed
    const existing = await reviewModel.findOne({ appointmentId })
    if (existing)
      return res.json({ success: false, message: 'You have already reviewed this appointment' })

    const newReview = await reviewModel.create({
      appointmentId,
      doctorId:     appt.docId,
      userId:       appt.userId,
      rating:       Number(rating),
      review:       review?.trim() || '',
      patientName:  appt.userData?.name  || '',
      patientImage: appt.userData?.image || '',
      doctorName:   appt.docData?.name   || '',
    })

    // Update doctor's average rating
    await updateDoctorRating(appt.docId)

    res.json({ success: true, message: 'Review submitted!', review: newReview })

  } catch (error) {
    if (error.code === 11000)
      return res.json({ success: false, message: 'You have already reviewed this appointment' })
    console.error('addReview error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── GET /api/review/doctor/:doctorId ─────────────────────────────────────────
// Get all visible reviews for a doctor (public)
export const getDoctorReviews = async (req, res) => {
  try {
    const { doctorId } = req.params
    const page  = parseInt(req.query.page)  || 1
    const limit = parseInt(req.query.limit) || 10
    const skip  = (page - 1) * limit

    const [reviews, total, stats] = await Promise.all([
      reviewModel
        .find({ doctorId, isHidden: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      reviewModel.countDocuments({ doctorId, isHidden: false }),

      // Rating distribution
      reviewModel.aggregate([
        { $match: { doctorId: new (await import('mongoose')).default.Types.ObjectId(doctorId), isHidden: false } },
        { $group: {
            _id:       '$rating',
            count:     { $sum: 1 },
            avgRating: { $avg: '$rating' },
        }},
        { $sort: { _id: -1 } },
      ])
    ])

    // Build distribution map 5→1
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    let   totalRating  = 0
    stats.forEach(s => {
      distribution[s._id] = s.count
      totalRating += s._id * s.count
    })
    const avgRating = total > 0 ? parseFloat((totalRating / total).toFixed(1)) : 0

    res.json({
      success: true,
      reviews,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: { avgRating, total, distribution }
    })

  } catch (error) {
    console.error('getDoctorReviews error:', error)
    res.json({ success: false, message: error.message })
  }
}

// ── GET /api/review/check/:appointmentId ────────────────────────────────────
// Check if patient already reviewed this appointment
export const checkReviewed = async (req, res) => {
  try {
    const { appointmentId } = req.params
    const existing = await reviewModel.findOne({ appointmentId }).lean()
    res.json({ success: true, reviewed: !!existing, review: existing || null })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// ── GET /api/review/admin/all ─────────────────────────────────────────────────
// Admin: get all reviews (including hidden)
export const getAllReviewsAdmin = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)   || 1
    const limit  = parseInt(req.query.limit)  || 20
    const filter = req.query.filter || 'all'   // all | hidden | visible
    const skip   = (page - 1) * limit

    const query = {}
    if (filter === 'hidden')  query.isHidden = true
    if (filter === 'visible') query.isHidden = false

    const [reviews, total] = await Promise.all([
      reviewModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      reviewModel.countDocuments(query),
    ])

    res.json({ success: true, reviews, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// ── POST /api/review/admin/toggle ────────────────────────────────────────────
// Admin: hide or show a review
export const toggleReviewVisibility = async (req, res) => {
  try {
    const { reviewId, hide, reason } = req.body
    if (!reviewId) return res.json({ success: false, message: 'reviewId required' })

    const rev = await reviewModel.findById(reviewId)
    if (!rev) return res.json({ success: false, message: 'Review not found' })

    rev.isHidden     = !!hide
    rev.hiddenReason = hide ? (reason || 'Removed by admin') : ''
    await rev.save()

    // Recalculate doctor rating
    await updateDoctorRating(rev.doctorId)

    res.json({ success: true, message: hide ? 'Review hidden' : 'Review restored' })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}

// ── DELETE /api/review/admin/:reviewId ───────────────────────────────────────
// Admin: permanently delete a review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const rev = await reviewModel.findByIdAndDelete(reviewId)
    if (!rev) return res.json({ success: false, message: 'Review not found' })
    await updateDoctorRating(rev.doctorId)
    res.json({ success: true, message: 'Review deleted permanently' })
  } catch (error) {
    res.json({ success: false, message: error.message })
  }
}