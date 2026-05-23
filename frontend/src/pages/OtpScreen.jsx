import React, { useRef, useState, useEffect, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'

const OtpScreen = () => {
  const { backendUrl, setToken } = useContext(AppContext)
  const navigate = useNavigate()
  const location = useLocation()

  const inputRefs = useRef([])
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [resendLoading, setResendLoading] = useState(false)
  const [shakeTrigger, setShakeTrigger] = useState(false)

  // Read state passed from Login.jsx via navigate('/verify-otp', { state: {...} })
  const userId  = location.state?.userId
  const email   = location.state?.email   || 'your email'
  const purpose = location.state?.purpose || 'login'

  // Resend countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  // ── Input handlers ───────────────────────────────────────────────────────

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return
    const updated = [...digits]
    updated[index] = value
    setDigits(updated)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    if (value && index === 5 && updated.every(d => d !== '')) {
      submitOtp(updated.join(''))
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const updated = [...digits]
        updated[index] = ''
        setDigits(updated)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft'  && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const updated = Array(6).fill('')
    pasted.split('').forEach((ch, i) => { updated[i] = ch })
    setDigits(updated)
    const lastIdx = Math.min(pasted.length - 1, 5)
    inputRefs.current[lastIdx]?.focus()
    if (pasted.length === 6) submitOtp(pasted)
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const submitOtp = async (otpValue) => {
    if (loading) return
    const otp = otpValue || digits.join('')
    if (otp.length < 6) return toast.error('Enter all 6 digits')

    setLoading(true)
    try {
      const { data } = await axios.post(backendUrl + '/api/user/verify-otp', {
        userId, otp, purpose
      })
      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        toast.success(purpose === 'signup' ? 'Account verified!' : 'Login successful!')
        navigate('/')
      } else {
        setShakeTrigger(true)
        setTimeout(() => setShakeTrigger(false), 600)
        setDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Resend ───────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return
    setResendLoading(true)
    try {
      const { data } = await axios.post(backendUrl + '/api/user/resend-otp', {
        userId, purpose
      })
      if (data.success) {
        toast.success('New OTP sent!')
        setResendTimer(30)
        setDigits(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setResendLoading(false)
    }
  }

  // ── If someone opens /verify-otp directly with no state, show message ────
  // (no useEffect redirect — that was causing the instant disappear bug)
  if (!userId) {
    return (
      <div className='min-h-[80vh] flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-500 dark:text-gray-400 mb-4'>
            Please login first to get an OTP.
          </p>
          <button
            onClick={() => navigate('/login')}
            className='bg-primary text-white px-6 py-2 rounded-full'
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  // ── Main OTP screen ──────────────────────────────────────────────────────
  return (
    <div className='min-h-[80vh] flex items-center justify-center
      bg-white dark:bg-gray-900 transition-colors'>
      <div className='flex flex-col items-center gap-6 p-8 w-full max-w-sm
        border dark:border-gray-700 rounded-2xl shadow-lg
        bg-white dark:bg-gray-800'>

        {/* Icon */}
        <div className='w-14 h-14 rounded-full bg-[#EAEFFF] dark:bg-indigo-900
          flex items-center justify-center text-2xl'>
          ✉️
        </div>

        {/* Heading */}
        <div className='text-center'>
          <p className='text-2xl font-semibold text-gray-800 dark:text-gray-100'>
            {purpose === 'signup' ? 'Verify your account' : 'Check your email'}
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
            {purpose === 'signup' ? 'Enter the OTP sent to' : 'We sent a 6-digit OTP to'}
          </p>
          <p className='text-sm font-medium text-primary mt-0.5'>{email}</p>
        </div>

        {/* 6 digit boxes */}
        <div
          className={`flex gap-3 ${shakeTrigger ? 'animate-shake' : ''}`}
          onPaste={handlePaste}
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type='text'
              inputMode='numeric'
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              className={`
                w-11 h-12 text-center text-xl font-semibold
                border-2 rounded-lg outline-none
                bg-white dark:bg-gray-700
                text-gray-800 dark:text-gray-100
                transition-colors duration-150
                ${digit
                  ? 'border-primary dark:border-primary'
                  : 'border-gray-300 dark:border-gray-600'
                }
                focus:border-primary dark:focus:border-primary
              `}
            />
          ))}
        </div>

        {/* Submit button */}
        <button
          onClick={() => submitOtp()}
          disabled={loading || digits.some(d => d === '')}
          className='w-full py-3 rounded-xl bg-primary text-white font-medium
            hover:bg-indigo-600 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Verifying...' : 'Verify OTP'}
        </button>

        {/* Resend */}
        <p className='text-sm text-gray-500 dark:text-gray-400'>
          Didn't receive it?{' '}
          <button
            onClick={handleResend}
            disabled={resendTimer > 0 || resendLoading}
            className={`font-medium transition-colors
              ${resendTimer > 0
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'text-primary hover:underline cursor-pointer'
              }`}
          >
            {resendLoading
              ? 'Sending...'
              : resendTimer > 0
                ? `Resend in ${resendTimer}s`
                : 'Resend OTP'
            }
          </button>
        </p>

        {/* Back to login */}
        <button
          onClick={() => navigate('/login')}
          className='text-sm text-gray-400 dark:text-gray-500
            hover:text-primary transition-colors'
        >
          ← Back to login
        </button>
      </div>
    </div>
  )
}

export default OtpScreen
