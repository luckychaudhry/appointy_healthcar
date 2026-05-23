import express from 'express'
import {
  addReview, getDoctorReviews, checkReviewed,
  getAllReviewsAdmin, toggleReviewVisibility, deleteReview
} from '../controllers/reviewController.js'
import authUser  from '../middlewares/authUser.js'
import authAdmin from '../middlewares/authAdmin.js'

const reviewRouter = express.Router()

// ── Patient routes ────────────────────────────────────────────────────────────
reviewRouter.post('/add',                       authUser,  addReview)
reviewRouter.get('/check/:appointmentId',        authUser,  checkReviewed)

// ── Public routes ─────────────────────────────────────────────────────────────
reviewRouter.get('/doctor/:doctorId',                      getDoctorReviews)

// ── Admin routes ──────────────────────────────────────────────────────────────
reviewRouter.get('/admin/all',                  authAdmin, getAllReviewsAdmin)
reviewRouter.post('/admin/toggle',              authAdmin, toggleReviewVisibility)
reviewRouter.delete('/admin/:reviewId',         authAdmin, deleteReview)

export default reviewRouter