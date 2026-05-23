// backend/controllers/analyticsController.js
// ── Proper MongoDB Aggregation Pipeline ───────────────────────────────────────
// Uses $facet, $lookup, $bucket, $group, $project in ONE single DB call

import appointmentModel from '../models/appointmentModel.js'
import doctorModel      from '../models/doctorModel.js'
import userModel        from '../models/userModel.js'
import mongoose         from 'mongoose'

export const getAnalytics = async (req, res) => {
  try {
    const { range = '30' } = req.query
    const days    = parseInt(range) || 30
    const fromMs  = Date.now() - days * 24 * 60 * 60 * 1000
    const fromNum = fromMs   // appointment.date is stored as Number (Date.now())

    // ── Main aggregation — ONE pipeline with $facet ───────────────────────────
    const [result] = await appointmentModel.aggregate([
      // ── Stage 1: filter by date range ──────────────────────────────────────
      { $match: { date: { $gte: fromNum } } },

      // ── Stage 2: $facet — run all sub-pipelines in parallel ─────────────────
      {
        $facet: {

          // ── 2a. KPI Summary ─────────────────────────────────────────────────
          kpi: [
            {
              $group: {
                _id: null,
                totalBookings:    { $sum: 1 },
                totalRevenue:     { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } },
                onlineRevenue:    { $sum: { $cond: [{ $and: [{ $eq: ['$payment', true] }, { $eq: ['$cancelled', false] }] }, '$amount', 0] } },
                cashRevenue:      { $sum: { $cond: [{ $and: [{ $eq: ['$payment', false] }, { $eq: ['$cancelled', false] }, { $eq: ['$isCompleted', false] }] }, '$amount', 0] } },
                completedRevenue: { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, '$amount', 0] } },
                totalCompleted:   { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
                totalCancelled:   { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
                totalPaid:        { $sum: { $cond: [{ $eq: ['$payment', true] }, 1, 0] } },
                totalPending:     { $sum: { $cond: [{ $and: [{ $eq: ['$isCompleted', false] }, { $eq: ['$cancelled', false] }] }, 1, 0] } },
                uniquePatients:   { $addToSet: '$userId' },
              }
            },
            {
              $project: {
                _id: 0,
                totalBookings:    1,
                totalRevenue:     1,
                onlineRevenue:    1,
                cashRevenue:      1,
                completedRevenue: 1,
                totalCompleted:   1,
                totalCancelled:   1,
                totalPaid:        1,
                totalPending:     1,
                uniquePatients:   { $size: '$uniquePatients' },
                cancelRate:       { $cond: [{ $gt: ['$totalBookings', 0] }, { $multiply: [{ $divide: ['$totalCancelled', '$totalBookings'] }, 100] }, 0] },
                completionRate:   { $cond: [{ $gt: ['$totalBookings', 0] }, { $multiply: [{ $divide: ['$totalCompleted', '$totalBookings'] }, 100] }, 0] },
              }
            }
          ],

          // ── 2b. Daily Trend (last 14 days) ──────────────────────────────────
          dailyTrend: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%d %b',
                    date:   { $toDate: '$date' },
                    timezone: 'Asia/Kolkata'
                  }
                },
                bookings:      { $sum: 1 },
                totalRevenue:  { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } },
                onlineRevenue: { $sum: { $cond: [{ $eq: ['$payment', true] }, '$amount', 0] } },
                cashRevenue:   { $sum: { $cond: [{ $and: [{ $eq: ['$payment', false] }, { $eq: ['$cancelled', false] }] }, '$amount', 0] } },
                completed:     { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
                cancelled:     { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
              }
            },
            { $sort: { _id: 1 } },
            { $limit: 14 },
            { $project: { _id: 0, day: '$_id', bookings: 1, totalRevenue: 1, onlineRevenue: 1, cashRevenue: 1, completed: 1, cancelled: 1 } }
          ],

          // ── 2c. Weekly Trend (bookings per weekday) ──────────────────────────
          weekdayTrend: [
            {
              $group: {
                _id: {
                  $dayOfWeek: { date: { $toDate: '$date' }, timezone: 'Asia/Kolkata' }
                },
                bookings: { $sum: 1 },
                revenue:  { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                dayNum:   '$_id',
                day: {
                  $arrayElemAt: [
                    ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                    '$_id'
                  ]
                },
                bookings: 1,
                revenue:  1
              }
            }
          ],

          // ── 2d. Speciality Breakdown ─────────────────────────────────────────
          specialityBreakdown: [
            { $match: { 'docData.speciality': { $exists: true } } },
            {
              $group: {
                _id:      '$docData.speciality',
                bookings: { $sum: 1 },
                revenue:  { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
              }
            },
            { $sort: { bookings: -1 } },
            { $project: { _id: 0, name: '$_id', bookings: 1, revenue: 1, completed: 1, cancelled: 1 } }
          ],

          // ── 2e. Top Doctors ──────────────────────────────────────────────────
          topDoctors: [
            {
              $group: {
                _id:        '$docId',
                name:       { $first: '$docData.name' },
                image:      { $first: '$docData.image' },
                speciality: { $first: '$docData.speciality' },
                bookings:   { $sum: 1 },
                revenue:    { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } },
                completed:  { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
                cancelled:  { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
                patients:   { $addToSet: '$userId' }
              }
            },
            { $sort: { bookings: -1 } },
            { $limit: 8 },
            {
              $project: {
                _id: 0,
                docId:     '$_id',
                name:       1,
                image:      1,
                speciality: 1,
                bookings:   1,
                revenue:    1,
                completed:  1,
                cancelled:  1,
                patients:   { $size: '$patients' },
                score: {
                  $subtract: [
                    { $cond: [{ $gt: ['$bookings', 0] }, { $multiply: [{ $divide: ['$completed', '$bookings'] }, 100] }, 0] },
                    { $cond: [{ $gt: ['$bookings', 0] }, { $multiply: [{ $divide: ['$cancelled', '$bookings'] }, 30] }, 0] }
                  ]
                }
              }
            }
          ],

          // ── 2f. Revenue Buckets ($bucket) — fee range distribution ───────────
          revenueBuckets: [
            { $match: { cancelled: false } },
            {
              $bucket: {
                groupBy:    '$amount',
                boundaries: [0, 200, 400, 600, 800, 1000, 1500, 2000, 5000],
                default:    '5000+',
                output: {
                  count:   { $sum: 1 },
                  revenue: { $sum: '$amount' }
                }
              }
            },
            {
              $project: {
                _id: 0,
                range: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$_id', 0]    }, then: '₹0-200'   },
                      { case: { $eq: ['$_id', 200]  }, then: '₹200-400' },
                      { case: { $eq: ['$_id', 400]  }, then: '₹400-600' },
                      { case: { $eq: ['$_id', 600]  }, then: '₹600-800' },
                      { case: { $eq: ['$_id', 800]  }, then: '₹800-1k'  },
                      { case: { $eq: ['$_id', 1000] }, then: '₹1k-1.5k' },
                      { case: { $eq: ['$_id', 1500] }, then: '₹1.5k-2k' },
                      { case: { $eq: ['$_id', 2000] }, then: '₹2k-5k'   },
                    ],
                    default: '₹5k+'
                  }
                },
                count:   1,
                revenue: 1,
              }
            }
          ],

          // ── 2g. Cancellation Reasons ─────────────────────────────────────────
          cancellationReasons: [
            { $match: { cancelled: true } },
            {
              $group: {
                _id:   { $ifNull: ['$cancelledBy', 'Unknown'] },
                count: { $sum: 1 }
              }
            },
            { $project: { _id: 0, cancelledBy: '$_id', count: 1 } }
          ],

          // ── 2h. Monthly Revenue Trend ────────────────────────────────────────
          monthlyTrend: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%b %Y',
                    date:   { $toDate: '$date' },
                    timezone: 'Asia/Kolkata'
                  }
                },
                revenue:  { $sum: { $cond: [{ $eq: ['$cancelled', false] }, '$amount', 0] } },
                bookings: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, month: '$_id', revenue: 1, bookings: 1 } }
          ],

          // ── 2i. Payment Method Split ─────────────────────────────────────────
          paymentSplit: [
            { $match: { cancelled: false } },
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ['$payment', true] },
                    'Online',
                    { $cond: [{ $eq: ['$isCompleted', true] }, 'Cash (Completed)', 'Cash (Pending)'] }
                  ]
                },
                count:   { $sum: 1 },
                revenue: { $sum: '$amount' }
              }
            },
            { $project: { _id: 0, method: '$_id', count: 1, revenue: 1 } }
          ],

          // ── 2j. Appointment Status Over Time (last 7 days) ──────────────────
          statusTimeline: [
            {
              $match: {
                date: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 }
              }
            },
            {
              $group: {
                _id: {
                  day: { $dateToString: { format: '%d %b', date: { $toDate: '$date' }, timezone: 'Asia/Kolkata' } },
                  status: {
                    $switch: {
                      branches: [
                        { case: { $eq: ['$cancelled', true] },   then: 'Cancelled' },
                        { case: { $eq: ['$isCompleted', true] }, then: 'Completed' },
                        { case: { $eq: ['$payment', true] },     then: 'Paid'      },
                      ],
                      default: 'Pending'
                    }
                  }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.day': 1 } },
            { $project: { _id: 0, day: '$_id.day', status: '$_id.status', count: 1 } }
          ],
        }
      }
    ])

    // ── Doctors count from doctorModel ────────────────────────────────────────
    const [doctorStats] = await doctorModel.aggregate([
      {
        $group: {
          _id:          null,
          totalDoctors:     { $sum: 1 },
          availableDoctors: { $sum: { $cond: ['$available', 1, 0] } }
        }
      },
      { $project: { _id: 0, totalDoctors: 1, availableDoctors: 1 } }
    ])

    // ── Users count ───────────────────────────────────────────────────────────
    const totalUsers = await userModel.countDocuments()

    // ── Format final response ─────────────────────────────────────────────────
    const kpi = result.kpi[0] || {}

    res.json({
      success: true,
      range:   days,
      data: {
        kpi: {
          ...kpi,
          totalDoctors:     doctorStats?.totalDoctors     || 0,
          availableDoctors: doctorStats?.availableDoctors || 0,
          totalUsers,
        },
        dailyTrend:          result.dailyTrend          || [],
        weekdayTrend:        result.weekdayTrend        || [],
        specialityBreakdown: result.specialityBreakdown || [],
        topDoctors:          result.topDoctors          || [],
        revenueBuckets:      result.revenueBuckets      || [],
        cancellationReasons: result.cancellationReasons || [],
        monthlyTrend:        result.monthlyTrend        || [],
        paymentSplit:        result.paymentSplit        || [],
        statusTimeline:      result.statusTimeline      || [],
      }
    })

  } catch (error) {
    console.error('getAnalytics error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}
