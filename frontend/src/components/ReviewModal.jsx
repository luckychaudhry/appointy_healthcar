import React, { useState, useContext } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'

// ── Star Rating Component ─────────────────────────────────────────────────────
const StarRating = ({ value, onChange, size = 32 }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    {[1, 2, 3, 4, 5].map(star => (
      <button
        key={star}
        type="button"
        onClick={() => onChange(star)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: size, padding: 0, lineHeight: 1,
          color: star <= value ? '#F59E0B' : '#E5E7EB',
          transition: 'color 0.15s, transform 0.1s',
          transform: star <= value ? 'scale(1.1)' : 'scale(1)',
        }}
      >
        ★
      </button>
    ))}
  </div>
)

const RATING_LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent' }

// ── Main Component ────────────────────────────────────────────────────────────
const ReviewModal = ({ appointment, onClose, onSubmitted }) => {
  const { backendUrl, token } = useContext(AppContext)
  const [rating,  setRating]  = useState(0)
  const [review,  setReview]  = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!rating) return toast.warn('Please select a star rating')

    setLoading(true)
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/review/add`,
        { appointmentId: appointment._id, rating, review },
        { headers: { token } }
      )
      if (data.success) {
        toast.success('Review submitted! Thank you.')
        onSubmitted?.()
        onClose()
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
        maxWidth: 440, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.25s ease',
      }}>
        <style>{`@keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={appointment.docData?.image}
              alt=""
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', background: '#EEF2FF' }}
            />
            <div>
              <p style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e', margin: 0 }}>
                Rate Dr. {appointment.docData?.name}
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                {appointment.docData?.speciality}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#F3F4F6', border: 'none', borderRadius: '50%',
            width: 30, height: 30, fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280'
          }}>✕</button>
        </div>

        {/* Stars */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>
            How was your consultation?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StarRating value={rating} onChange={setRating} size={40} />
          </div>
          {rating > 0 && (
            <p style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', margin: '8px 0 0' }}>
              {RATING_LABELS[rating]}
            </p>
          )}
        </div>

        {/* Review text */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#374151', fontWeight: 500, margin: '0 0 6px' }}>
            Write a review <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </p>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Share your experience with the doctor..."
            style={{
              width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 10,
              padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
              resize: 'none', outline: 'none', color: '#374151',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#5F6FFF'}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
          <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right', margin: '3px 0 0' }}>
            {review.length}/500
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', border: '1.5px solid #E5E7EB',
            borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', background: '#fff', color: '#374151'
          }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!rating || loading}
            style={{
              flex: 2, padding: '12px',
              background: rating ? 'linear-gradient(135deg,#5F6FFF,#8B5CF6)' : '#E5E7EB',
              color: rating ? '#fff' : '#9CA3AF',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: rating ? 'pointer' : 'not-allowed',
              boxShadow: rating ? '0 4px 16px rgba(95,111,255,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Submitting...' : '⭐ Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReviewModal