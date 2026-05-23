// admin/src/pages/Admin/AnalyticsDashboard.jsx
// ── Uses /api/analytics — proper MongoDB aggregation pipeline ─────────────────

import React, { useContext, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import useAnalytics from '../../hooks/UseAnalytics'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  primary: '#5F6FFF', success: '#10B981', warning: '#F59E0B',
  danger:  '#EF4444', purple:  '#8B5CF6', cyan:    '#06B6D4',
  pink:    '#EC4899', indigo:  '#6366F1',
}
const SPEC_COLORS = [C.primary, C.success, C.warning, C.purple, C.cyan, C.pink, C.pink, C.indigo]

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1E1E2E', border: '1px solid #3a3a5c',
      borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#fff',
    }}>
      <p style={{ color: '#aaa', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 600 }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}
        </p>
      ))}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color, icon }) => (
  <div style={{
    background: '#fff', borderRadius: 16, padding: '20px 22px',
    border: '1px solid #f0f0f8', position: 'relative', overflow: 'hidden',
    boxShadow: '0 2px 16px rgba(95,111,255,0.07)'
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: color, borderRadius: '16px 16px 0 0' }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>{label}</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px', letterSpacing: '-0.02em' }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{sub}</p>}
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, background: color + '18' }}>
        {icon}
      </div>
    </div>
  </div>
)

// ── Chart Card ────────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 16, padding: '22px',
    border: '1px solid #f0f0f8', boxShadow: '0 2px 16px rgba(95,111,255,0.07)', ...style
  }}>
    {children}
  </div>
)

const SH = ({ title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{title}</h3>
    {sub && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>{sub}</p>}
  </div>
)

// ── Loading Skeleton ──────────────────────────────────────────────────────────
const Skeleton = ({ h = 200 }) => (
  <div style={{ height: h, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', borderRadius: 12, animation: 'shimmer 1.5s infinite' }} />
)

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const AnalyticsDashboard = () => {
  const { aToken, backendUrl } = useContext(AdminContext)
  const [range, setRange]      = useState('30')
  const currency               = '₹'

  const { data, loading, error, refetch } = useAnalytics(backendUrl, aToken, range)

  const kpi = data?.kpi || {}
  const fmt = (n) => typeof n === 'number' ? Math.round(n).toLocaleString() : '—'
  const pct = (n) => typeof n === 'number' ? n.toFixed(1) + '%' : '—'

  // Normalize weekday trend — fill missing days
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const weekdayMap = {}
  ;(data?.weekdayTrend || []).forEach(w => { weekdayMap[w.day] = w })
  const weekData = weekdays.map(d => weekdayMap[d] || { day: d, bookings: 0, revenue: 0 })

  // Status timeline — pivot for stacked bar
  const statusMap = {}
  ;(data?.statusTimeline || []).forEach(({ day, status, count }) => {
    if (!statusMap[day]) statusMap[day] = { day }
    statusMap[day][status] = count
  })
  const statusTimeline = Object.values(statusMap)

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: '#F8F7FF', minHeight: '100vh', padding: '24px 24px 48px' }}>

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0, letterSpacing: '-0.02em' }}>
            Analytics Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
            Powered by MongoDB Aggregation Pipeline · Real-time data
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['7','30','90'].map(d => (
            <button key={d} onClick={() => setRange(d)} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: range === d ? 'none' : '1px solid #E5E7EB',
              background: range === d ? C.primary : '#fff',
              color: range === d ? '#fff' : '#6B7280', transition: 'all 0.2s'
            }}>{d}d</button>
          ))}
          <button onClick={refetch} style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
            border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280'
          }}>↻</button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#DC2626', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        {loading ? Array(6).fill(0).map((_,i) => <Skeleton key={i} h={110} />) : <>
          <StatCard label="Total Revenue"    value={`${currency}${fmt(kpi.totalRevenue)}`}    icon="💰" color={C.primary} sub={`Online: ${currency}${fmt(kpi.onlineRevenue)} · Cash: ${currency}${fmt(kpi.cashRevenue)}`} />
          <StatCard label="Total Bookings"   value={fmt(kpi.totalBookings)}   icon="📅" color={C.indigo}  sub={`Last ${range} days`} />
          <StatCard label="Completed"        value={fmt(kpi.totalCompleted)}  icon="✅" color={C.success} sub={`${pct(kpi.completionRate)} completion`} />
          <StatCard label="Cancellations"    value={fmt(kpi.totalCancelled)}  icon="❌" color={C.danger}  sub={`${pct(kpi.cancelRate)} cancel rate`} />
          <StatCard label="Unique Patients"  value={fmt(kpi.uniquePatients)}  icon="👤" color={C.purple}  sub={`Total users: ${fmt(kpi.totalUsers)}`} />
          <StatCard label="Active Doctors"   value={`${kpi.availableDoctors || 0}/${kpi.totalDoctors || 0}`} icon="🩺" color={C.cyan} sub="Currently available" />
        </>}
      </div>

      {/* ── Row 1: Area chart + Payment split ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <SH title="Revenue Trend" sub="Online + Cash revenue daily (from DB aggregation)" />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data?.dailyTrend || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.success} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.success} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip prefix={currency} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="onlineRevenue" name="Online" stroke={C.primary} strokeWidth={2.5} fill="url(#gO)" dot={false} />
                <Area type="monotone" dataKey="cashRevenue"   name="Cash"   stroke={C.success} strokeWidth={2.5} fill="url(#gC)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SH title="Payment Method Split"  />
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={data?.paymentSplit || []} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="revenue" paddingAngle={3} strokeWidth={0}>
                    {(data?.paymentSplit || []).map((_, i) => <Cell key={i} fill={[C.primary, C.success, C.warning][i % 3]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip prefix={currency} />} formatter={(v, n, p) => [`${currency}${v.toLocaleString()}`, p.payload.method]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(data?.paymentSplit || []).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: [C.primary, C.success, C.warning][i % 3] }} />
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{p.method}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{p.count} appts</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{currency}{p.revenue?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 2: Stacked status timeline + Weekday bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <SH title="Appointment Status Timeline"  />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusTimeline} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Completed" stackId="a" fill={C.success} radius={[0,0,0,0]} />
                <Bar dataKey="Paid"      stackId="a" fill={C.primary} radius={[0,0,0,0]} />
                <Bar dataKey="Pending"   stackId="a" fill={C.warning} radius={[0,0,0,0]} />
                <Bar dataKey="Cancelled" stackId="a" fill={C.danger}  radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SH title="Bookings by Weekday"  />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip suffix=" bookings" />} />
                <Bar dataKey="bookings" name="Bookings" radius={[6,6,0,0]}>
                  {weekData.map((e, i) => (
                    <Cell key={i} fill={['Sat','Sun'].includes(e.day) ? C.success : C.cyan} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Row 3: Speciality pie + Revenue Buckets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <SH title="Bookings by Speciality" />
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data?.specialityBreakdown || []} cx="50%" cy="50%" outerRadius={72} dataKey="bookings" paddingAngle={2} strokeWidth={0}>
                    {(data?.specialityBreakdown || []).map((_, i) => <Cell key={i} fill={SPEC_COLORS[i % SPEC_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip suffix=" bookings" />} formatter={(v,n,p) => [v, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(data?.specialityBreakdown || []).slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: SPEC_COLORS[i % SPEC_COLORS.length] }} />
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{s.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{s.bookings}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>{currency}{s.revenue?.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <SH title="Fee Range Distribution"  />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data?.revenueBuckets || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="count" name="Appointments" fill={C.indigo + '80'} radius={[4,4,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name={`Revenue (${currency})`} stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Row 4: Completed vs Cancelled line + Cancellation reasons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <SH title="Completed vs Cancelled — Daily"  />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.dailyTrend || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke={C.success} strokeWidth={2.5} dot={{ r: 3, fill: C.success }} />
                <Line type="monotone" dataKey="cancelled"  name="Cancelled"  stroke={C.danger}  strokeWidth={2.5} dot={{ r: 3, fill: C.danger }} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="bookings"   name="Total"      stroke={C.indigo}  strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SH title="Cancellation by Source"  />
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={data?.cancellationReasons || []}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                    dataKey="count" paddingAngle={3} strokeWidth={0}
                    nameKey="cancelledBy"
                  >
                    {(data?.cancellationReasons || []).map((_, i) => (
                      <Cell key={i} fill={[C.danger, C.warning, C.purple][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip suffix=" cancellations" />} formatter={(v,n,p) => [v, p.payload.cancelledBy]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.cancellationReasons || []).map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: [C.danger, C.warning, C.purple][i % 3] }} />
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>By {r.cancelledBy}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{r.count}</span>
                  </div>
                ))}
                {!(data?.cancellationReasons?.length) && (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No cancellations in this period</p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 5: Top Doctors Table ── */}
      <Card style={{ marginBottom: 16 }}>
        <SH title="Top Performing Doctors"  />
        {loading ? <Skeleton h={280} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                  {['#','Doctor','Speciality','Bookings','Revenue','Patients','Completed','Cancelled','Score'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === '#' ? 'center' : 'left', color: '#9CA3AF', fontWeight: 600, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.topDoctors || []).map((doc, i) => {
                  const score = Math.round(doc.score || 0)
                  const scoreColor = score > 70 ? C.success : score > 40 ? C.warning : C.danger
                  return (
                    <tr key={i}
                      style={{ borderBottom: '1px solid #F9FAFB', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8F7FF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: i === 0 ? '#FEF3C7' : '#F3F4F6', color: i === 0 ? '#D97706' : '#6B7280' }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={doc.image} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', background: '#EEF2FF' }} />
                          <span style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 12 }}>{doc.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: C.primary + '18', color: C.primary, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{doc.speciality}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1a1a2e', textAlign: 'center' }}>{doc.bookings}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: C.success }}>{`₹${doc.revenue?.toLocaleString()}`}</td>
                      <td style={{ padding: '10px 12px', color: C.purple, fontWeight: 600, textAlign: 'center' }}>{doc.patients}</td>
                      <td style={{ padding: '10px 12px', color: C.success, fontWeight: 600, textAlign: 'center' }}>{doc.completed}</td>
                      <td style={{ padding: '10px 12px', color: C.danger,  fontWeight: 600, textAlign: 'center' }}>{doc.cancelled}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.max(0, Math.min(score, 100))}%`, height: '100%', background: scoreColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', minWidth: 24 }}>{score}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!(data?.topDoctors?.length) && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No data for this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Row 6: Monthly trend + Doctor availability ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <Card>
          <SH title="Monthly Revenue & Bookings"  />
          {loading ? <Skeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data?.monthlyTrend || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="bookings" name="Bookings" fill={C.indigo + '80'} radius={[4,4,0,0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name={`Revenue (₹)`} stroke={C.primary} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SH title="Doctor Availability" sub="$group from doctorModel" />
          {loading ? <Skeleton /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 200, justifyContent: 'center' }}>
              <ResponsiveContainer width={130} height={130}>
                <RadialBarChart cx="50%" cy="50%" innerRadius={32} outerRadius={58}
                  data={[{ value: kpi.totalDoctors ? Math.round((kpi.availableDoctors / kpi.totalDoctors) * 100) : 0, fill: C.success }]}
                  startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#F3F4F6' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div>
                <p style={{ fontSize: 34, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>
                  {kpi.totalDoctors ? Math.round((kpi.availableDoctors / kpi.totalDoctors) * 100) : 0}
                  <span style={{ fontSize: 16, color: '#9CA3AF' }}>%</span>
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 14px' }}>availability rate</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Available', value: kpi.availableDoctors, color: C.success },
                    { label: 'Unavailable', value: (kpi.totalDoctors || 0) - (kpi.availableDoctors || 0), color: '#E5E7EB' },
                  ].map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{d.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginLeft: 'auto' }}>{d.value || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}

export default AnalyticsDashboard