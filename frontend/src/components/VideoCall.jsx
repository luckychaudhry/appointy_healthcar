import React, { useEffect, useRef, useState, useCallback } from 'react'

const APP_ID     = 1164488927
const SERVER_SEC = '72e3e9d53577a5af1c0c01949ea2d659'

const VideoCall = ({ appointmentId, userName, role = 'patient', onClose, socket }) => {
  const containerRef  = useRef(null)
  const zegoRef       = useRef(null)
  const timerRef      = useRef(null)
  const hangUpRef     = useRef(null)
  const destroyedRef  = useRef(false)

  const [loading,    setLoading]    = useState(true)
  const [timeLeft,   setTimeLeft]   = useState(21 * 60)
  const [error,      setError]      = useState(null)
  const [callEnded,  setCallEnded]  = useState(false)

  // Unique room — same appointmentId = same room, always
  const roomID   = `appointy${appointmentId?.toString().slice(-10).replace(/[^a-zA-Z0-9]/g, '')}`
  const userID   = `${role}-${appointmentId?.toString().slice(-6)}-${Date.now()}`
  const dispName = userName || (role === 'doctor' ? 'Doctor' : 'Patient')

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) { clearInterval(timerRef.current); hangUpRef.current?.(); return 0 }
        return p - 1
      })
    }, 1000)
  }, [])

  const safeDestroy = useCallback(() => {
    if (destroyedRef.current) return
    destroyedRef.current = true
    clearInterval(timerRef.current)
    try { zegoRef.current?.destroy() } catch (e) {}
    zegoRef.current = null
  }, [])

  const hangUp = useCallback(() => {
    safeDestroy()
    if (role === 'doctor' && socket) {
      try { socket.emit('doctor:endCall', { appointmentId }) } catch (e) {}
    }
    setCallEnded(true)
  }, [safeDestroy, role, socket, appointmentId])

  useEffect(() => { hangUpRef.current = hangUp }, [hangUp])

  const initZego = useCallback(() => {
    if (!containerRef.current) return
    try {
      const { ZegoUIKitPrebuilt } = window
      if (!ZegoUIKitPrebuilt) { setError('SDK load failed'); setLoading(false); return }

      const token = ZegoUIKitPrebuilt.generateKitTokenForTest(
        APP_ID, SERVER_SEC, roomID, userID, dispName
      )
      zegoRef.current = ZegoUIKitPrebuilt.create(token)
      zegoRef.current.joinRoom({
        container:            containerRef.current,
        scenario:             { mode: ZegoUIKitPrebuilt.OneONoneCall },
        showPreJoinView:      false,
        showLeavingView:      false,
        maxUsers:             2,
        showRoomDetailsButton:    false,
        showInviteToCohostButton: false,
        showRemoveUserButton:     false,
        branding:             { logoURL: '' },
        onJoinRoom:  () => { setLoading(false); startTimer() },
        onLeaveRoom: () => hangUpRef.current?.(),
        onUserLeave: () => hangUpRef.current?.(),
      })
    } catch (err) {
      setError(err.message || 'Connection failed')
      setLoading(false)
    }
  }, [roomID, userID, dispName, startTimer])

  useEffect(() => {
    // Notify patient via socket that doctor started call
    if (role === 'doctor' && socket) {
      try {
        socket.emit('doctor:startCall', {
          appointmentId,
          doctorName: userName || 'Doctor',
        })
      } catch (e) {}
    }

    const script   = document.createElement('script')
    script.src     = 'https://unpkg.com/@zegocloud/zego-uikit-prebuilt/zego-uikit-prebuilt.js'
    script.async   = true
    script.onload  = initZego
    script.onerror = () => { setError('SDK load failed — check internet'); setLoading(false) }
    document.head.appendChild(script)

    return () => {
      safeDestroy()
      if (role === 'doctor' && socket) {
        try { socket.emit('doctor:endCall', { appointmentId }) } catch (e) {}
      }
    }
  }, [])

  const timerColor = timeLeft < 120 ? '#EF4444' : timeLeft < 300 ? '#F59E0B' : '#10B981'

  // ── Call ended screen ──────────────────────────────────────────────────────
  if (callEnded) return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px',
        maxWidth: 380, width: '100%', margin: '0 16px',
        textAlign: 'center', animation: 'slideUp 0.35s ease',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', margin: '0 0 8px' }}>
          Consultation Complete!
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 6px' }}>
          Session duration: <strong>{fmt(1200 - timeLeft)}</strong>
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px' }}>
          {role === 'doctor'
            ? 'You can now add prescription from appointments page.'
            : 'Your consultation has ended successfully.'
          }
        </p>
        <button onClick={() => onClose?.()}
          style={{
            width: '100%', padding: '13px',
            background: 'linear-gradient(135deg,#5F6FFF,#8B5CF6)',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(95,111,255,0.3)'
          }}>
          {role === 'doctor' ? '📋 Back to Appointments' : '📅 My Appointments'}
        </button>
      </div>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.88)', animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        width: '100%', maxWidth: 940, height: '92vh', margin: '0 16px',
        borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: '#0d0d1a',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
        animation: 'slideUp 0.35s cubic-bezier(.34,1.56,.64,1)',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 18px', flexShrink: 0,
          background: 'rgba(26,26,46,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, fontSize: 16,
              background: role === 'doctor'
                ? 'linear-gradient(135deg,#10B981,#059669)'
                : 'linear-gradient(135deg,#5F6FFF,#8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {role === 'doctor' ? '🩺' : '🏥'}
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0 }}>
                {role === 'doctor' ? 'Consultation (Host)' : 'Video Visit'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: loading ? '#F59E0B' : '#10B981',
                  animation: !loading ? 'pulse 2s infinite' : 'none',
                }}/>
                <span style={{ color: '#6b7280', fontSize: 11 }}>
                  {loading ? 'Connecting...' : 'Live · Private Room · Encrypted'}
                </span>
              </div>
            </div>
            <div style={{
              background: 'rgba(95,111,255,0.12)', border: '1px solid rgba(95,111,255,0.25)',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#818CF8', fontWeight: 600,
            }}>🔒 Private</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {!loading && !error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: `${timerColor}20`, borderRadius: 20,
                padding: '5px 14px 5px 8px',
                border: `1px solid ${timerColor}33`,
                transition: 'background 0.5s',
              }}>
                <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
                  <circle cx="16" cy="16" r="12" fill="none"
                    stroke={timerColor} strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 12}`}
                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - timeLeft / 1200)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                  />
                </svg>
                <span style={{ color: timerColor, fontWeight: 800, fontSize: 16, fontFamily: 'monospace', minWidth: 44 }}>
                  {fmt(timeLeft)}
                </span>
              </div>
            )}

            <button onClick={hangUp} style={{
  background: 'linear-gradient(135deg,#EF4444,#DC2626)',
  color: '#fff',
  border: 'none',
  borderRadius: 20,
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
  transition: 'transform 0.15s',

  position: 'fixed',
  bottom: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 999999,
}}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span>📵</span> End Call
            </button>
          </div>
        </div>

        {/* ── Loading screen ── */}
        {loading && !error && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
            background: 'linear-gradient(180deg,#0d0d1a 0%,#111128 100%)',
          }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  position: 'absolute', inset: i * 12, borderRadius: '50%',
                  border: `2px solid rgba(95,111,255,${0.8 - i * 0.25})`,
                  animation: `ring 1.6s ${i * 0.2}s ease-in-out infinite`,
                }}/>
              ))}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>📹</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>
                {role === 'doctor' ? 'Starting Consultation...' : 'Joining Consultation...'}
              </p>
              <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
                Encrypted · Private · Secure
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#5F6FFF',
                  animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}/>
              ))}
            </div>
          </div>
        )}

        {/* ── Error screen ── */}
        {error && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center',
          }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⚠️</div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, margin: 0 }}>Connection Failed</p>
            <p style={{ color: '#EF4444', fontSize: 13, margin: 0, maxWidth: 300 }}>{error}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setError(null); setLoading(true); destroyedRef.current = false; initZego() }}
                style={{ background: '#5F6FFF', color: '#fff', border: 'none', borderRadius: 20, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ↻ Retry
              </button>
              <button onClick={() => onClose?.()}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '9px 22px', fontSize: 13, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── Zego container ── */}
        <div ref={containerRef} style={{
          flex: 1, display: error ? 'none' : 'block',
          opacity: loading ? 0 : 1, transition: 'opacity 0.5s ease',
        }}/>

        {/* ── Warning banner ── */}
        {timeLeft < 120 && timeLeft > 0 && !loading && !error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', borderTop: '1px solid rgba(239,68,68,0.3)',
            padding: '9px 18px', textAlign: 'center', flexShrink: 0,
          }}>
            <span style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 600 }}>
              ⏰ {fmt(timeLeft)} remaining — session will end automatically
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(0.9)} }
        @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes ring    { 0%{opacity:.8;transform:scale(1)} 100%{opacity:0;transform:scale(1.6)} }
      `}</style>
    </div>
  )
}

export default VideoCall