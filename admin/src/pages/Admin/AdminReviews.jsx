import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import axios from 'axios'
import { toast } from 'react-toastify'

const Stars = ({ value }) => (
  <span style={{ color: '#F59E0B', fontSize: 13 }}>
    {'★'.repeat(Math.round(value))}{'☆'.repeat(5 - Math.round(value))}
  </span>
)

const AdminReviews = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const [reviews, setReviews]  = useState([])
  const [total,   setTotal]    = useState(0)
  const [page,    setPage]     = useState(1)
  const [pages,   setPages]    = useState(1)
  const [filter,  setFilter]   = useState('all')
  const [loading, setLoading]  = useState(true)
  const [reason,  setReason]   = useState('')
  const [hiding,  setHiding]   = useState(null)

  const fetchReviews = async (pg = 1, f = filter) => {
    setLoading(true)
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/review/admin/all?page=${pg}&limit=15&filter=${f}`,
        { headers: { aToken } }
      )
      if (data.success) {
        setReviews(data.reviews)
        setTotal(data.total)
        setPage(pg)
        setPages(data.pages)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleVisibility = async (reviewId, hide) => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/review/admin/toggle`,
        { reviewId, hide, reason },
        { headers: { aToken } }
      )
      if (data.success) {
        toast.success(data.message)
        setHiding(null)
        setReason('')
        fetchReviews(page)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Permanently delete this review?')) return
    try {
      const { data } = await axios.delete(
        `${backendUrl}/api/review/admin/${reviewId}`,
        { headers: { aToken } }
      )
      if (data.success) {
        toast.success('Review deleted')
        fetchReviews(page)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    if (aToken) fetchReviews(1, filter)
  }, [aToken, filter])

  const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtDate = (d) => {
    const dt = new Date(d)
    return `${dt.getDate()} ${MONTHS[dt.getMonth()+1]} ${dt.getFullYear()}`
  }

  return (
    <div className='m-5 w-full max-w-6xl'>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
            Patient Reviews
          </h2>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0' }}>
            {total} total review{total !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','All'], ['visible','Visible'], ['hidden','Hidden']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              style={{
                padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: '1px solid',
                borderColor: filter === val ? '#5F6FFF' : '#E5E7EB',
                background: filter === val ? '#5F6FFF' : '#fff',
                color: filter === val ? '#fff' : '#6B7280',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #F3F4F6', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #F3F4F6' }}>
              {['Patient', 'Doctor', 'Rating', 'Review', 'Date', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#6B7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Loading...</td></tr>
              : reviews.length === 0
                ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No reviews found</td></tr>
                : reviews.map((rev, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #F9FAFB',
                      background: rev.isHidden ? '#FEF2F2' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => !rev.isHidden && (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => !rev.isHidden && (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#EEF2FF', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#5F6FFF',
                          flexShrink: 0,
                        }}>
                          {rev.patientName?.[0]?.toUpperCase() || 'P'}
                        </div>
                        <span style={{ fontWeight: 500, color: '#1a1a2e' }}>{rev.patientName || 'Patient'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>
                      Dr. {rev.doctorName}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Stars value={rev.rating} />
                        <span style={{ fontSize: 12, color: '#6B7280' }}>({rev.rating})</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#4B5563', maxWidth: 200 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {rev.review || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No text</span>}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {fmtDate(rev.createdAt)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {rev.isHidden
                        ? <span style={{ background: '#FEE2E2', color: '#DC2626', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Hidden</span>
                        : <span style={{ background: '#D1FAE5', color: '#059669', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>Visible</span>
                      }
                      {rev.hiddenReason && (
                        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>{rev.hiddenReason}</p>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {rev.isHidden
                          ? <button
                              onClick={() => toggleVisibility(rev._id, false)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #D1FAE5', background: '#F0FDF4', color: '#059669', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Restore
                            </button>
                          : <button
                              onClick={() => setHiding(rev._id)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Hide
                            </button>
                        }
                        <button
                          onClick={() => deleteReview(rev._id)}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#9CA3AF', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* Hide reason input */}
                      {hiding === rev._id && (
                        <div style={{ marginTop: 8 }}>
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontSize: 11, marginBottom: 4, boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => toggleVisibility(rev._id, true)}
                              style={{ flex: 1, padding: '4px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >Confirm Hide</button>
                            <button
                              onClick={() => { setHiding(null); setReason('') }}
                              style={{ flex: 1, padding: '4px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 11, cursor: 'pointer' }}
                            >Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

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

export default AdminReviews