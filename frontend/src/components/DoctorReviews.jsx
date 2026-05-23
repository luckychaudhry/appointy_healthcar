import React, { useState, useEffect } from 'react'
import axios from 'axios'

// ── Star display ──────────────────────────────────────────────────────────────
const Stars = ({ value, size = 14 }) => (
  <span style={{ color: '#F59E0B', fontSize: size, letterSpacing: 1 }}>
    {'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}
  </span>
)

// ── Rating bar row ────────────────────────────────────────────────────────────
const RatingBar = ({ star, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#6B7280', minWidth: 16 }}>{star}★</span>
      <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#F59E0B', borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 24 }}>{count}</span>
    </div>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────
const ReviewCard = ({ rev }) => {
  const date = new Date(rev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div style={{
      border: '1px solid #F3F4F6', borderRadius: 12, padding: '14px 16px',
      marginBottom: 10, background: '#FAFAFA',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rev.patientImage
            ? <img src={rev.patientImage} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#5F6FFF' }}>
                {rev.patientName?.[0]?.toUpperCase() || 'P'}
              </div>
          }
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: 0 }}>{rev.patientName || 'Patient'}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{date}</p>
          </div>
        </div>
        <Stars value={rev.rating} />
      </div>
      {rev.review && (
        <p style={{ fontSize: 13, color: '#4B5563', margin: 0, lineHeight: 1.6 }}>
          "{rev.review}"
        </p>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const DoctorReviews = ({ doctorId, backendUrl }) => {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)

  const fetchReviews = async (pg = 1) => {
    setLoading(true)
    try {
      const { data: res } = await axios.get(
        `${backendUrl}/api/review/doctor/${doctorId}?page=${pg}&limit=5`
      )
      if (res.success) {
        setData(res)
        setPage(pg)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (doctorId && backendUrl) fetchReviews(1)
  }, [doctorId])

  if (loading && !data) return (
    <div style={{ textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: 13 }}>
      Loading reviews...
    </div>
  )

  if (!data || data.total === 0) return (
    <div style={{
      textAlign: 'center', padding: '24px', background: '#F9FAFB',
      borderRadius: 12, border: '1px dashed #E5E7EB'
    }}>
      <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>No reviews yet — be the first to review!</p>
    </div>
  )

  const { reviews, stats, total, pages } = data

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
          Patient Reviews
        </h2>
        <span style={{
          background: '#FEF3C7', color: '#D97706', padding: '3px 10px',
          borderRadius: 20, fontSize: 12, fontWeight: 600
        }}>
          {stats.avgRating} ★ · {total} reviews
        </span>
      </div>

      {/* Stats section */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20,
        marginBottom: 24, background: '#fff', border: '1px solid #F3F4F6',
        borderRadius: 14, padding: '20px',
      }}>
        {/* Average big number */}
        <div style={{ textAlign: 'center', borderRight: '1px solid #F3F4F6', paddingRight: 20 }}>
          <p style={{ fontSize: 48, fontWeight: 800, color: '#1a1a2e', margin: 0, lineHeight: 1 }}>
            {stats.avgRating}
          </p>
          <Stars value={stats.avgRating} size={18} />
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' }}>
            {total} review{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Distribution bars */}
        <div style={{ paddingLeft: 4 }}>
          {[5, 4, 3, 2, 1].map(star => (
            <RatingBar
              key={star}
              star={star}
              count={stats.distribution[star] || 0}
              total={total}
            />
          ))}
        </div>
      </div>

      {/* Review list */}
      {loading
        ? <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 16 }}>Loading...</div>
        : reviews.map((rev, i) => <ReviewCard key={i} rev={rev} />)
      }

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map(pg => (
            <button
              key={pg}
              onClick={() => fetchReviews(pg)}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: '1.5px solid',
                borderColor: pg === page ? '#5F6FFF' : '#E5E7EB',
                background: pg === page ? '#5F6FFF' : '#fff',
                color: pg === page ? '#fff' : '#6B7280',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {pg}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default DoctorReviews