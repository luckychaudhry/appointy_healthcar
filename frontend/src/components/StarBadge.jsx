const StarBadge = ({ avgRating, totalReviews }) => {
  if (!avgRating || avgRating === 0) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#FEF3C7', borderRadius: 20,
      padding: '2px 8px', fontSize: 12,
    }}>
      <span style={{ color: '#F59E0B', fontSize: 13 }}>★</span>
      <span style={{ fontWeight: 700, color: '#D97706' }}>{avgRating}</span>
      {totalReviews > 0 && (
        <span style={{ color: '#92400E', fontSize: 11 }}>({totalReviews})</span>
      )}
    </div>
  )
}

export default StarBadge