import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from './context/AppContext'
import RelatedDoctors from './components/RelatedDoctors'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from './assets/assets'
import DoctorReviews from './components/DoctorReviews'
import StarBadge     from './components/StarBadge'

const Appointment = () => {
  const { docId } = useParams()
  const {
    doctors, currencySymbol, backendUrl,
    token, getDoctorsData
  } = useContext(AppContext)

  const navigate   = useNavigate()
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const [docInfo,        setDocInfo]        = useState(null)
  const [docSlots,       setDocSlots]       = useState([])
  const [slotIndex,      setSlotIndex]      = useState(0)
  const [slotTime,       setSlotTime]       = useState('')
  const [loading,        setLoading]        = useState(false)
  const [completedSlots, setCompletedSlots] = useState(new Set())
  const [cancelledSlots, setCancelledSlots] = useState(new Set())
  const [hasActiveAppt,  setHasActiveAppt]  = useState(false)
  const [activeApptInfo, setActiveApptInfo] = useState('')
        const [consultationType, setConsultationType] = useState('in-person')


  // ── Fetch user's appointments to know completed + doctor-cancelled slots ──
  const fetchSlotStatuses = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/user/appointments`,
        {},
        { headers: { token } }
      )
      if (data.success) {
        const completed = new Set()
        const cancelled = new Set()
        const months = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

        // Active appointment check — is doctor ke saath koi pending/paid appointment
        const active = data.appointments.find(a =>
          a.docId === docId && !a.cancelled && !a.isCompleted
        )
        if (active) {
          setHasActiveAppt(true)
          const [d, m, y] = active.slotDate.split('_')
          setActiveApptInfo(`${d} ${months[Number(m)]} ${y} at ${active.slotTime}`)
        } else {
          setHasActiveAppt(false)
          setActiveApptInfo('')
        }

        data.appointments.forEach(a => {
          if (a.docId === docId) {
            const key = `${a.slotDate}|${a.slotTime}`
            if (a.isCompleted)                             completed.add(key)
            if (a.cancelled && a.cancelledBy === 'Doctor') cancelled.add(key)
          }
        })
        setCompletedSlots(completed)
        setCancelledSlots(cancelled)
      }
    } catch (err) {
      console.log('fetchSlotStatuses error:', err.message)
    }
  }

  // ── Fetch doctor info ────────────────────────────────────────────────────
  const fetchDocInfo = () => {
    const doc = doctors.find(d => d._id === docId)
    setDocInfo(doc)
  }

  // ── Generate slots for next 7 days ───────────────────────────────────────
  const getAvailableSlots = () => {
    if (!docInfo) return
    setDocSlots([])

    const today = new Date()

    const allSlots = Array.from({ length: 7 }, (_, i) => {
      const current = new Date(today)
      current.setDate(today.getDate() + i)

      const endTime = new Date(current)
      endTime.setHours(21, 0, 0, 0)

      if (i === 0) {
        current.setMinutes(current.getMinutes() > 30 ? 30 : 0)
        current.setHours(current.getHours() < 10 ? 10 : current.getHours())
      } else {
        current.setHours(10, 0, 0, 0)
      }

      const slots = []

      while (current < endTime) {
        const formattedTime = current.toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit'
        })

        const d        = current.getDate()
        const m        = current.getMonth() + 1
        const y        = current.getFullYear()
        const slotDate = `${d}_${m}_${y}`
        const key      = `${slotDate}|${formattedTime}`

        const isBooked     = docInfo.slots_booked?.[slotDate]?.includes(formattedTime) || false
        const isCompleted  = completedSlots.has(key)
        const isCancelled  = cancelledSlots.has(key)

        slots.push({
          datetime:   new Date(current),
          time:       formattedTime,
          slotDate,
          isBooked,
          isCompleted,
          isCancelled,
        })

        current.setMinutes(current.getMinutes() + 30)
      }

      return slots
    })

    setDocSlots(allSlots)
  }

  // ── Book appointment ─────────────────────────────────────────────────────
  const bookAppointment = async () => {
    if (!token) {
      toast.warn('Please login to book appointment')
      return navigate('/login')
    }
    if (!slotTime) return toast.warn('Please select a time slot')

    const slot = docSlots[slotIndex]?.find(s => s.time === slotTime)
    if (!slot) return toast.error('Invalid slot selected')

    setLoading(true)
    try {
      const { data } = await axios.post(
        backendUrl + '/api/user/book-appointment',
        { docId, slotDate: slot.slotDate, slotTime,consultationType },
        { headers: { token } }
      )
      
      if (data.success) {
        toast.success('Appointment booked!')
        getDoctorsData()
        navigate('/my-appointments')
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { getDoctorsData() }, [])

  useEffect(() => { fetchDocInfo() }, [doctors, docId])

  useEffect(() => {
    if (docInfo) {
      if (token) {
        fetchSlotStatuses().then(() => getAvailableSlots())
      } else {
        getAvailableSlots()
      }
    }
  }, [docInfo])

  useEffect(() => {
    if (docInfo) getAvailableSlots()
  }, [completedSlots, cancelledSlots])

  if (!docInfo) return null

  return (
    <div>
      {/* ── Doctor info ── */}
      <div className='flex flex-col sm:flex-row gap-4'>
        <div>
          <img
            className='bg-primary w-full sm:max-w-72 rounded-lg'
            src={docInfo.image}
            alt={docInfo.name}
          />
        </div>

        <div className='flex-1 border border-[#ADADAD] rounded-lg p-8 py-7 bg-white'>
          <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>
            {docInfo.name}
            <img className='w-5' src={assets.verified_icon} alt="verified" />
             {docInfo.avgRating > 0 && (
    <span className='flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full text-sm'>
      <span style={{ color: '#F59E0B' }}>★</span>
      <span className='font-bold text-yellow-600'>{docInfo.avgRating}</span>
      <span className='text-gray-400 text-xs'>({docInfo.totalReviews})</span>
    </span>
  )}
</p>
          <div className='flex items-center gap-2 mt-1 text-gray-600'>
            <p>{docInfo.degree} - {docInfo.speciality}</p>
            <button className='py-0.5 px-2 border text-xs rounded-full'>
              {docInfo.experience}
            </button>
          </div>

          <div>
            <p className='flex items-center gap-1 text-sm font-medium text-gray-900 mt-3'>
              About <img className='w-3' src={assets.info_icon} alt="" />
            </p>
            <p className='text-sm text-gray-500 max-w-[700px] mt-1'>
              {docInfo.about}
            </p>
          </div>

          <p className='text-gray-500 font-medium mt-4'>
            Appointment fee:{' '}
            <span className='text-gray-600'>{currencySymbol}{docInfo.fees}</span>
          </p>
        </div>
      </div>

// Slot picker se pehle ye add karo:
<div className='sm:ml-72 sm:pl-4 mt-6'>
  <p className='text-sm font-semibold text-gray-700 mb-3'>Consultation Type</p>
  <div className='flex gap-3'>
    <button
      onClick={() => setConsultationType('in-person')}
      className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all
        ${consultationType === 'in-person'
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-gray-200 text-gray-500 hover:border-gray-300'
        }`}
    >
      🏥 In-Person Visit
      <p className='text-xs font-normal mt-0.5 opacity-70'>Visit clinic physically</p>
    </button>
    <button
      onClick={() => setConsultationType('video')}
      className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all
        ${consultationType === 'video'
          ? 'border-violet-500 bg-violet-50 text-violet-600'
          : 'border-gray-200 text-gray-500 hover:border-gray-300'
        }`}
    >
      📹 Video Consultation
      <p className='text-xs font-normal mt-0.5 opacity-70'>Online from home</p>
    </button>
    
  </div>
  
{consultationType === 'video' && (
  <div className='flex items-center gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2'>
    <span className='text-amber-500 text-sm'>⚠️</span>
    <p className='text-xs text-amber-600 font-medium'>
      For video consultation, online payment is required. Please select the video consultation option and proceed to book your appointment.
    </p>
  </div>
)}
</div>

      {/* ── Slot picker ── */}
      <div className='sm:ml-72 sm:pl-4 mt-8 font-medium text-[#565656]'>
        <p className='text-lg font-semibold text-gray-700 mb-1'>Booking Slots</p>
        <p className='text-sm text-gray-400 mb-4'>
          ✓ Completed &nbsp;|&nbsp; ✕ Cancelled by doctor &nbsp;|&nbsp; 🔒 Booked
        </p>

        {/* Day selector */}
        <div className='flex gap-3 items-center w-full overflow-x-scroll pb-2'>
          {docSlots.map((daySlots, idx) => (
            <div
              key={idx}
              onClick={() => { setSlotIndex(idx); setSlotTime('') }}
              className={`
                flex flex-col items-center min-w-16 py-3 px-3 rounded-xl cursor-pointer
                transition-all duration-200 select-none
                ${slotIndex === idx
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'border border-gray-200 hover:border-primary'
                }
              `}
            >
              <p className='text-sm font-medium'>
                {daySlots[0] && daysOfWeek[daySlots[0].datetime.getDay()]}
              </p>
              <p className='text-2xl font-bold'>
                {daySlots[0] && daySlots[0].datetime.getDate()}
              </p>
              {daySlots.some(s => s.isBooked) && (
                <div className={`w-1.5 h-1.5 rounded-full mt-1 ${slotIndex === idx ? 'bg-white/60' : 'bg-orange-400'}`}/>
              )}
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className='flex items-start gap-3 w-full flex-wrap mt-5'>
          {docSlots[slotIndex]?.map((slot, idx) => (
            <SlotButton
              key={idx}
              slot={slot}
              isSelected={slotTime === slot.time}
              isBooked={slot.isBooked}
              isCompleted={slot.isCompleted}
              isCancelled={slot.isCancelled}
              onClick={() => { if (!slot.isBooked) setSlotTime(slot.time) }}
            />
          ))}
        </div>

        {/* Legend */}
        <div className='flex items-center gap-5 mt-5 text-xs text-gray-400'>
          <div className='flex items-center gap-1.5'>
            <div className='w-3 h-3 rounded-full bg-primary'/>
            <span>Available</span>
          </div>
          <div className='flex items-center gap-1.5'>
            <div className='w-3 h-3 rounded-full bg-gray-200'/>
            <span>Booked</span>
          </div>
          <div className='flex items-center gap-1.5'>
            <div className='w-3 h-3 rounded-full bg-green-200'/>
            <span>Completed</span>
          </div>
          <div className='flex items-center gap-1.5'>
            <div className='w-3 h-3 rounded-full bg-red-200'/>
            <span>Cancelled</span>
          </div>
          <div className='flex items-center gap-1.5'>
            <div className='w-3 h-3 rounded-full border-2 border-primary'/>
            <span>Selected</span>
          </div>
        </div>

        {/* Active appointment warning */}
        {hasActiveAppt && (
          <div className='mt-5 w-full max-w-md bg-amber-50 border border-amber-200
            rounded-xl px-4 py-3 text-sm text-amber-800'>
            <p className='font-semibold mb-0.5'>⚠️ Active appointment exists</p>
            <p className='text-xs text-amber-700'>
              You already have a booking with this doctor on <strong>{activeApptInfo}</strong>.
              Please cancel it first or wait for it to complete before booking again.
            </p>
          </div>
        )}

        {/* Book button */}
        <button
          onClick={bookAppointment}
          disabled={!slotTime || loading || hasActiveAppt}
          className='bg-primary text-white text-sm font-light px-20 py-3 rounded-full
            my-6 hover:bg-indigo-600 transition-all
            disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Booking...' : 'Book an Appointment'}
        </button>
      </div>
        <div className='mt-8'>
  <DoctorReviews doctorId={docId} backendUrl={backendUrl} />
</div>
      {/* Related doctors */}
      <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
      
    </div>
  )
}

// ── SlotButton ────────────────────────────────────────────────────────────────
const SlotButton = ({ slot, isSelected, isBooked, isCompleted, isCancelled, onClick }) => {

  if (isBooked) {
    return (
      <div className='relative group'>
        <div className={`
          text-xs sm:text-sm px-4 py-2 rounded-full border
          cursor-not-allowed select-none flex items-center gap-1.5
          ${isCompleted
            ? 'border-green-200 bg-green-50'
            : isCancelled
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }
        `}>
          <span className={`line-through ${
            isCompleted  ? 'text-green-300'
            : isCancelled ? 'text-red-300'
            : 'text-gray-300'
          }`}>
            {slot.time}
          </span>
          <span className='text-[10px]'>
            {isCompleted ? '✓' : isCancelled ? '✕' : '🔒'}
          </span>
        </div>

        {/* Tooltip */}
        <div className='
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          bg-gray-800 text-white text-[10px] px-2 py-1 rounded-md
          whitespace-nowrap opacity-0 group-hover:opacity-100
          transition-opacity duration-200 pointer-events-none z-10
        '>
          {isCompleted  ? 'Appointment completed'
           : isCancelled ? 'Cancelled by doctor'
           : 'Already booked'}
          <div className='absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-gray-800'/>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`
        text-xs sm:text-sm px-5 py-2 rounded-full
        transition-all duration-200 select-none
        ${isSelected
          ? 'bg-primary text-white shadow-md shadow-primary/30 scale-105'
          : 'border border-gray-200 text-gray-600 hover:border-primary hover:text-primary'
        }
      `}
    >
      {slot.time}
    </button>
  )
}

export default Appointment
