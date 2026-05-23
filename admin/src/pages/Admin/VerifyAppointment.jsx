import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useContext } from 'react'
import { AdminContext } from '../../context/AdminContext'

/* ── helpers ── */
const statusConfig = {
  confirmed: { label: 'Confirmed', bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
  completed: { label: 'Completed', bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
  cancelled: { label: 'Cancelled', bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  expired: { label: 'Expired', bg: '#fff7ed', color: '#ea580c', dot: '#f97316' },
}
const getStatus = (appt) => {
  if (appt.cancelled) return 'cancelled'
  if (appt.isCompleted) return 'completed'
  const [d, m, y] = (appt.slotDate || '').split('_').map(Number)
  if (new Date(y, m - 1, d) < new Date(new Date().setHours(0, 0, 0, 0))) return 'expired'
  return 'confirmed'
}
const formatDate = (slotDate) => {
  if (!slotDate) return 'N/A'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [d, mo, y] = slotDate.split('_')
  return `${parseInt(d)} ${months[parseInt(mo) - 1]} ${y}`
}
const formatTime = (ts) => {
  if (!ts) return '--:--'
  const d = new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

/* ═══════════════════════════════════════════════ */
const VerifyAppointment = () => {
  const { aToken, backendUrl } = useContext(AdminContext)

  // ── verify states ──
  const [mode, setMode] = useState('manual')
  const [inputId, setInputId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [scannerReady, setScannerReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanFlash, setScanFlash] = useState(null)
  const [flashData, setFlashData] = useState(null)

  // ── check-in history states ──
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('verify')  // 'verify' | 'history'

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const scannedOnce = useRef(false)

  /* ── load history from localStorage ── */
  useEffect(() => {
    const saved = localStorage.getItem('appointy_checkin_history')
    if (saved) {
      try { setHistory(JSON.parse(saved)) } catch (_) { }
    }
  }, [])

  /* ── save check-in to history ── */
  const saveCheckIn = (appointment) => {
    const entry = {
      id: appointment._id,
      shortId: appointment._id?.slice(-8).toUpperCase(),
      patientName: appointment.userData?.name || 'N/A',
      patientEmail: appointment.userData?.email || '',
      doctorName: appointment.docData?.name || 'N/A',
      speciality: appointment.docData?.speciality || '',
      slotDate: appointment.slotDate,
      slotTime: appointment.slotTime,
      payment: appointment.payment,
      checkinTime: Date.now(),
      status: getStatus(appointment),
    }
    setHistory(prev => {
      // avoid duplicate check-in for same appointment
      const filtered = prev.filter(h => h.id !== entry.id)
      const updated = [entry, ...filtered].slice(0, 50)  // keep last 50
      localStorage.setItem('appointy_checkin_history', JSON.stringify(updated))
      return updated
    })
    toast.success(`${entry.patientName} checked in!`)
  }

  /* ── fetch appointment by encrypted JWT token (scan) or short ID (manual) ── */
  const fetchByToken = useCallback(async (jwtToken, silent = false) => {
    if (!silent) { setLoading(true); setResult(null); setError('') }
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/verify-qr`,
        { qrToken: jwtToken },
        { headers: { aToken } }
      )
      if (data.success) {
        if (silent) {
          setFlashData(data.appointment)
          setScanFlash('found')
          setTimeout(() => { setScanFlash('show'); setResult(data.appointment) }, 1800)
        } else {
          setResult(data.appointment)
        }
      } else {
        setError(data.message || 'Invalid or expired QR')
        scannedOnce.current = false
      }
    } catch { setError('Server error'); scannedOnce.current = false }
    finally { if (!silent) setLoading(false) }
  }, [aToken, backendUrl])

  const fetchByShortId = useCallback(async (id, silent = false) => {
    const cleanId = id.trim().toUpperCase().replace(/\s/g, '')
    if (!cleanId) { toast.error('Enter a valid ID'); return }
    if (cleanId.length < 8) { setError('Minimum 8 characters required'); return }
    if (!silent) { setLoading(true); setResult(null); setError('') }
    try {
      const { data } = await axios.get(
        `${backendUrl}/api/admin/appointment/short/${cleanId}`,
        { headers: { aToken } }
      )
      if (data.success) {
        if (silent) {
          setFlashData(data.appointment)
          setScanFlash('found')
          setTimeout(() => { setScanFlash('show'); setResult(data.appointment) }, 1800)
        } else {
          setResult(data.appointment)
        }
      } else {
        setError(data.message || 'Appointment not found with this ID')
        scannedOnce.current = false
      }
    } catch { setError('Server error'); scannedOnce.current = false }
    finally { if (!silent) setLoading(false) }
  }, [aToken, backendUrl])

  /* ── QR scan handler — tries JWT first, then shortId fallback ── */
  const handleQrScan = useCallback((decodedText) => {
    if (scannedOnce.current) return
    scannedOnce.current = true
    const raw = decodedText.trim()

    // JWT tokens have 3 dot-separated base64 parts
    const isJwt = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(raw)
    if (isJwt) {
      stopScanner()
      setInputId('(encrypted QR)')
      fetchByToken(raw, true)
      return
    }

    // Fallback: try JSON shortId
    let shortId = null
    try {
      const parsed = JSON.parse(raw)
      shortId = parsed.shortId || parsed.appointmentId?.slice(-8).toUpperCase()
    } catch (_) { }
    if (!shortId && raw.length >= 8) shortId = raw.slice(-8).toUpperCase()

    if (shortId) {
      stopScanner()
      setInputId(shortId)
      fetchByShortId(shortId, true)
    }
  }, [fetchByToken, fetchByShortId])

  /* ── scanner start/stop ── */
  /* ── start scanner using native BarcodeDetector + video stream ── */
  const startScanner = async () => {
    setMode('scanner'); setResult(null); setError('')
    setScanFlash(null); setFlashData(null); setScannerReady(false)
    scannedOnce.current = false
    stopScanner()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream

      // wait for video element to mount
      await new Promise(r => setTimeout(r, 80))
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true); setScannerReady(true)

      // Use native BarcodeDetector if available (Chrome/Edge — instant)
      // else fallback to @zxing/browser
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (!videoRef.current || scannedOnce.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) handleQrScan(codes[0].rawValue)
          } catch (_) { }
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // zxing fallback — load from CDN
        const { BrowserQRCodeReader } = await import('https://esm.sh/@zxing/browser@0.1.4')
        const reader = new BrowserQRCodeReader()
        reader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (result && !scannedOnce.current) handleQrScan(result.getText())
        })
      }
    } catch (err) {
      setError('Camera access denied. Browser mein camera permission allow karein.')
      setMode('manual')
    }
  }

  const stopScanner = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current.srcObject = null }
    setScanning(false)
  }

  useEffect(() => () => stopScanner(), [])

  /* ── today's history filter ── */
  const todayHistory = history.filter(h => {
    const d = new Date(h.checkinTime)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const status = result ? getStatus(result) : null
  const cfg = status ? statusConfig[status] : null

  /* ════════ RENDER ════════ */
  return (
    <div className='m-5 max-w-2xl'>

      {/* Page header */}
      <div className='mb-5 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-gray-800'>Verify Appointment</h1>
          <p className='text-sm text-gray-400 mt-0.5'>Scan QR code or enter appointment ID</p>
        </div>
        {todayHistory.length > 0 && (
          <div className='flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-xl px-3 py-1.5'>
            <span className='w-2 h-2 rounded-full bg-green-500 animate-pulse' />
            <span className='text-xs text-green-700 font-medium'>{todayHistory.length} checked in today</span>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className='flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit'>
        {[
          { key: 'verify', label: 'Verify', icon: 'ti-qrcode' },
          { key: 'history', label: 'History', icon: 'ti-history', count: todayHistory.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <i className={`ti ${t.icon}`} aria-hidden='true' />
            {t.label}
            {t.count > 0 && (
              <span className='bg-[#5f6fff] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none'>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ VERIFY TAB ══ */}
      {activeTab === 'verify' && (
        <>
          {/* Mode toggle */}
          <div className='flex gap-2 mb-5'>
            <button
              onClick={() => { stopScanner(); setMode('manual'); setResult(null); setError(''); setScanFlash(null) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${mode === 'manual' ? 'bg-[#5f6fff] text-white shadow-md shadow-[#5f6fff33]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <i className='ti ti-keyboard' aria-hidden='true' /> Manual ID
            </button>
            <button
              onClick={startScanner}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${mode === 'scanner' ? 'bg-[#5f6fff] text-white shadow-md shadow-[#5f6fff33]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              <i className='ti ti-scan' aria-hidden='true' /> Scan QR
            </button>
          </div>

          {/* Manual input */}
          {mode === 'manual' && (
            <div className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-5'>
              <label className='block text-sm font-medium text-gray-600 mb-2'>Appointment ID (last 8 digits)</label>
              <div className='flex gap-2'>
                <input
                  type='text'
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && fetchByShortId(inputId)}
                  placeholder='e.g. 5B9ABE41'
                  maxLength={8}
                  className='flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest
                             focus:outline-none focus:ring-2 focus:ring-[#5f6fff40] focus:border-[#5f6fff]
                             placeholder:text-gray-300 transition-all uppercase'
                />
                <button
                  onClick={() => fetchByShortId(inputId)}
                  disabled={loading}
                  className='bg-[#5f6fff] hover:bg-[#4a5aee] disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2'
                >
                  {loading
                    ? <svg className='animate-spin' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'><path d='M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4' /></svg>
                    : 'Verify'
                  }
                </button>
              </div>
            </div>
          )}

          {/* Scanner */}
          {mode === 'scanner' && (
            <div className='bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-5'>
              {scanFlash === 'found' && (
                <div className='flex flex-col items-center justify-center py-10 gap-4'>
                  <div className='w-20 h-20 rounded-full flex items-center justify-center' style={{ background: '#22c55e' }}>
                    <svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='3' strokeLinecap='round'><path d='M5 13l4 4L19 7' /></svg>
                  </div>
                  <div className='text-center'>
                    <p className='text-xl font-bold text-green-600'>Appointment Found!</p>
                    <p className='text-sm text-gray-400 mt-1'>{flashData?.userData?.name || 'Patient'} — loading details...</p>
                  </div>
                  <div className='w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden'>
                    <div className='h-full bg-green-500 rounded-full' style={{ animation: 'growBar 1.8s linear forwards' }} />
                  </div>
                  <style>{`@keyframes growBar{from{width:0}to{width:100%}}`}</style>
                </div>
              )}
              {scanFlash === null && (
                <>
                  <div className='flex items-center justify-between mb-3'>
                    <p className='text-sm font-medium text-gray-600'>{scannerReady ? 'QR code ke saamne camera rakho' : 'Camera start ho raha hai...'}</p>
                    <button onClick={() => { stopScanner(); setMode('manual') }} className='text-xs text-gray-400 hover:text-gray-600'>✕ Cancel</button>
                  </div>
                  <div className='relative w-full rounded-xl overflow-hidden bg-black' style={{ minHeight: 280 }}>
                    <video
                      ref={videoRef}
                      className='w-full rounded-xl'
                      style={{ minHeight: 280, objectFit: 'cover' }}
                      muted playsInline autoPlay
                    />
                    {/* scan box overlay */}
                    <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                      <div className='relative w-52 h-52'>
                        {/* corners */}
                        {[['top-0 left-0', 'border-t-2 border-l-2'], ['top-0 right-0', 'border-t-2 border-r-2'],
                        ['bottom-0 left-0', 'border-b-2 border-l-2'], ['bottom-0 right-0', 'border-b-2 border-r-2']
                        ].map(([pos, border], i) => (
                          <div key={i} className={`absolute w-6 h-6 ${pos} ${border} border-white rounded-sm`} />
                        ))}
                        {/* scan line */}
                        <div className='absolute left-0 right-0 h-0.5 bg-[#5f6fff]' style={{ animation: 'scanLine 1.5s ease-in-out infinite', top: '50%' }} />
                      </div>
                    </div>
                    <style>{`@keyframes scanLine{0%,100%{transform:translateY(-60px);opacity:0.6}50%{transform:translateY(60px);opacity:1}}`}</style>
                  </div>
                  {!scannerReady && (
                    <div className='flex items-center justify-center gap-2 mt-3 text-sm text-gray-400'>
                      <svg className='animate-spin' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83' /></svg>
                     Checking camera permissions...
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className='bg-red-50 border border-red-100 rounded-2xl p-4 mb-5 flex items-start gap-3'>
              <div className='w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0'>
                <span className='text-red-500 text-base'>✕</span>
              </div>
              <div>
                <p className='text-sm font-semibold text-red-700'>Verify Nahi Hua</p>
                <p className='text-xs text-red-500 mt-0.5'>{error}</p>
              </div>
            </div>
          )}

          {/* Result card */}
          {result && cfg && scanFlash !== 'found' && (
            <div className='bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden' style={{ animation: 'fadeUp 0.4s ease' }}>
              <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
              <div className='h-1.5 w-full' style={{ background: cfg.dot }} />
              <div className='px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-50'>
                <div className='flex items-center gap-3'>
                  <img
                    src={result.docData?.image || ''}
                    alt=''
                    className='w-11 h-11 rounded-full object-cover border-2 border-gray-100'
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(result.docData?.name || 'Dr')}&background=5f6fff&color=fff` }}
                  />
                  <div>
                    <p className='text-sm font-semibold text-gray-800'>{result.docData?.name || 'N/A'}</p>
                    <p className='text-xs text-gray-400'>{result.docData?.speciality || ''}</p>
                  </div>
                </div>
                <div className='flex flex-col items-end gap-1.5'>
                  <div className='flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full' style={{ background: cfg.bg, color: cfg.color }}>
                    <span className='w-1.5 h-1.5 rounded-full' style={{ background: cfg.dot }} />{cfg.label}
                  </div>
                  {/* show lock if verified via JWT */}
                  <div className='flex items-center gap-1 text-[10px] text-green-600 font-medium'>
                    <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                      <rect x='3' y='11' width='18' height='11' rx='2' /><path d='M7 11V7a5 5 0 0 1 10 0v4' />
                    </svg>
                    Verified
                  </div>
                </div>
              </div>

              <div className='px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3'>
                {[
                  { label: 'Patient Name', value: result.userData?.name || 'N/A' },
                  { label: 'Patient Email', value: result.userData?.email || 'N/A' },
                  { label: 'Date', value: formatDate(result.slotDate) },
                  { label: 'Time', value: result.slotTime || 'N/A' },
                  { label: 'Appointment ID', value: result._id?.slice(-8).toUpperCase(), mono: true },
                  { label: 'Payment', value: result.payment ? 'Paid Online ✓' : 'Pay at Clinic', highlight: result.payment ? '#16a34a' : '#d97706' },
                ].map(({ label, value, mono, highlight }) => (
                  <div key={label}>
                    <p className='text-[11px] text-gray-400 uppercase tracking-wide mb-0.5'>{label}</p>
                    <p className={`text-sm font-medium text-gray-700 truncate ${mono ? 'font-mono' : ''}`} style={highlight ? { color: highlight } : {}}>{value}</p>
                  </div>
                ))}
              </div>

              <div className='px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3'>
                <p className='text-xs text-gray-400'>Verified at {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                <div className='flex gap-2'>
                  <button
                    onClick={() => { setResult(null); setInputId(''); setScanFlash(null); scannedOnce.current = false }}
                    className='text-xs px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 transition-all'
                  >Clear</button>
                  {!result.cancelled && !result.isCompleted && (
                    <button
                      onClick={async () => {
                        await axios.post(`${backendUrl}/api/admin/checkin`,
                          { appointmentId: result._id },
                          { headers: { aToken } }
                        )
                        saveCheckIn(result)
                        setResult(null); setInputId(''); setScanFlash(null); scannedOnce.current = false
                      }}
                      className='text-xs px-4 py-2 rounded-xl bg-[#5f6fff] text-white hover:bg-[#4a5aee] transition-all font-medium flex items-center gap-1.5'
                    >
                      <i className='ti ti-circle-check' aria-hidden='true' /> Mark Check-in
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ HISTORY TAB ══ */}
      {activeTab === 'history' && (
        <div>
          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm font-medium text-gray-700'>
              Today's Check-ins
              <span className='ml-2 text-xs text-gray-400 font-normal'>
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </p>
            {todayHistory.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Clear all check-in history from today? This action cannot be undone.')) {
                    const allHistory = history.filter(h => {
                      const d = new Date(h.checkinTime)
                      const now = new Date()
                      return !(d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
                    })
                    setHistory(allHistory)
                    localStorage.setItem('appointy_checkin_history', JSON.stringify(allHistory))
                  }
                }}
                className='text-xs text-red-400 hover:text-red-600 flex items-center gap-1'
              >
                <i className='ti ti-trash' aria-hidden='true' /> Clear today
              </button>
            )}
          </div>

          {todayHistory.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
              <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center'>
                <i className='ti ti-clipboard-list text-gray-400' style={{ fontSize: 24 }} aria-hidden='true' />
              </div>
              <p className='text-sm font-medium text-gray-500'>Today there are no check-ins</p>
              <p className='text-xs text-gray-400'>When admin clicks "Mark Check-in", it will appear here</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {todayHistory.map((entry, i) => {
                const scfg = statusConfig[entry.status] || statusConfig.confirmed
                return (
                  <div key={entry.id + i} className='bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4'>
                    {/* index circle */}
                    <div className='w-8 h-8 rounded-full bg-[#5f6fff15] flex items-center justify-center flex-shrink-0'>
                      <span className='text-xs font-semibold text-[#5f6fff]'>{i + 1}</span>
                    </div>

                    {/* main info */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-semibold text-gray-800 truncate'>{entry.patientName}</p>
                        <span className='text-[10px] font-mono text-gray-400'>{entry.shortId}</span>
                      </div>
                      <p className='text-xs text-gray-400 truncate'>
                        {entry.doctorName}
                        {entry.speciality ? ` · ${entry.speciality}` : ''}
                      </p>
                    </div>

                    {/* right side */}
                    <div className='text-right flex-shrink-0'>
                      <p className='text-xs font-medium text-gray-700'>{formatTime(entry.checkinTime)}</p>
                      <div className='flex items-center gap-1 mt-1 justify-end'>
                        <span className='w-1.5 h-1.5 rounded-full' style={{ background: scfg.dot }} />
                        <span className='text-[10px]' style={{ color: scfg.color }}>{scfg.label}</span>
                      </div>
                      {entry.payment && (
                        <p className='text-[10px] text-green-600 mt-0.5'>Paid ✓</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VerifyAppointment