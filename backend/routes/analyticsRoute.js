// backend/routes/analyticsRoute.js
import express from 'express'
import { getAnalytics } from '../controllers/analyticsController.js'
import authAdmin from '../middlewares/authAdmin.js'

const analyticsRouter = express.Router()

// GET /api/analytics?range=7|30|90
analyticsRouter.get('/', authAdmin, getAnalytics)

export default analyticsRouter
