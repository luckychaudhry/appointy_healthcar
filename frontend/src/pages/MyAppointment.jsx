import React, { useContext, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'
import { io } from 'socket.io-client'
import ReviewModal from '../components/ReviewModal'
import VideoCall from '../components/VideoCall'
import AppointmentQR from '../components/AppointmentQR'

// ── Timeline ──────────────────────────────────────────────────────────────────
const AppointmentTimeline = ({ item }) => {
  const isConfirmed = item.status === 'confirmed' || item.isCompleted
  const steps = [
    { label:'Booked',    done:true },
    { label:'Confirmed', done:isConfirmed },
    { label:'Paid',      done:!!item.payment },
    { label:'Completed', done:!!item.isCompleted },
  ]
  if (item.cancelled) return null
  const doneCnt = steps.filter(s => s.done).length
  const pct = doneCnt<=1?'0%':doneCnt===2?'33%':doneCnt===3?'66%':'calc(100% - 24px)'
  return (
    <div className='w-full mt-3'>
      <div className='flex items-center justify-between relative'>
        <div className='absolute left-3 right-3 top-3 h-0.5 bg-gray-200 z-0'/>
        <div className='absolute left-3 top-3 h-0.5 z-0 bg-primary transition-all duration-500' style={{width:pct}}/>
        {steps.map((step,i) => (
          <div key={i} className='flex flex-col items-center gap-1 z-10'>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all
              ${step.done?'bg-primary text-white shadow-md':'bg-gray-100 text-gray-400'}`}>
              {step.done?'✓':i+1}
            </div>
            <span className={`text-[9px] font-medium ${step.done?'text-primary':'text-gray-400'}`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── minutesUntil ──────────────────────────────────────────────────────────────
const minutesUntil = (slotDate, slotTime) => {
  try {
    const [d,m,y]         = slotDate.split('_')
    const [timePart, per] = (slotTime||'').split(' ')
    const [hh, mm]        = timePart.split(':')
    let h = parseInt(hh)||0
    if (per==='PM'&&h!==12) h+=12
    if (per==='AM'&&h===12) h=0
    return (new Date(+y,+m-1,+d,h,parseInt(mm)||0) - new Date()) / 60000
  } catch { return 9999 }
}
const isCancelable = (slotDate, slotTime) => minutesUntil(slotDate, slotTime) > 60

// ─────────────────────────────────────────────────────────────────────────────
const MyAppointments = () => {
  const { backendUrl, token, getDoctorsData } = useContext(AppContext)
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [appointments,       setAppointments]       = useState([])
  const [payment,            setPayment]            = useState('')
  const [downloadingInvoice, setDownloadingInvoice] = useState(null)
  const [downloadingRx,      setDownloadingRx]      = useState(null)
  const [rxModal,            setRxModal]            = useState(false)
  const [rxLoading,          setRxLoading]          = useState(false)
  const [rxList,             setRxList]             = useState([])
  const [rxAppt,             setRxAppt]             = useState(null)
  const [activeTab,          setActiveTab]          = useState('all')
  const [countdown,          setCountdown]          = useState('')
  const [reviewAppt,         setReviewAppt]         = useState(null)
  const [reviewed,           setReviewed]           = useState({})
  const [videoCall,          setVideoCall]          = useState(null)
  const [incomingCall,       setIncomingCall]       = useState(null)

  const MONTHS = [' ','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtDate = (s) => { const [d,m,y]=s.split('_'); return `${d} ${MONTHS[+m]} ${y}` }

  // ── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !backendUrl) return
    socketRef.current = io(backendUrl, { transports: ['websocket'] })
    socketRef.current.on('call:incoming', ({ appointmentId, doctorName, meetLink }) => {
      setIncomingCall({ appointmentId, doctorName, meetLink })
      setVideoCall(prev => prev?.appointmentId === appointmentId ? { ...prev, meetLink } : prev)
      toast.dismiss('call')
      toast.info(`📹 Dr. ${doctorName} has started the call!`, { autoClose: 8000, toastId: 'call' })
    })
    socketRef.current.on('call:ended', ({ appointmentId }) => {
      setIncomingCall(prev => prev?.appointmentId === appointmentId ? null : prev)
      setVideoCall(prev => prev?.appointmentId === appointmentId ? null : prev)
    })
    return () => socketRef.current?.disconnect()
  }, [token, backendUrl])

  // ── Fetch ────────────────────────────────────────────────────────────────
  const getUserAppointments = async () => {
    try {
      const { data } = await axios.post(backendUrl+'/api/user/appointments',{},{headers:{token}})
      setAppointments(data.appointments.reverse())
    } catch (err) { toast.error(err.message) }
  }

  useEffect(() => {
    if (token) {
      getUserAppointments()
      const iv = setInterval(getUserAppointments, 30000)
      return () => clearInterval(iv)
    }
  }, [token])

  // ── Countdown ────────────────────────────────────────────────────────────
  const nextAppt = appointments.find(a => !a.cancelled && !a.isCompleted)
  useEffect(() => {
    if (!nextAppt) return
    const [d,m,y]   = nextAppt.slotDate.split('_')
    const [tp, per] = nextAppt.slotTime.split(' ')
    const [hh, mm]  = tp.split(':')
    let h = parseInt(hh)
    if (per==='PM'&&h!==12) h+=12
    if (per==='AM'&&h===12) h=0
    const t = new Date(+y,+m-1,+d,h,parseInt(mm))
    const update = () => {
      const diff = t - new Date()
      if (diff<=0) { setCountdown('Now!'); return }
      const days = Math.floor(diff/86400000)
      const hrs  = Math.floor((diff%86400000)/3600000)
      const mins = Math.floor((diff%3600000)/60000)
      setCountdown(days>0?`${days}d ${hrs}h ${mins}m`:`${hrs}h ${mins}m`)
    }
    update()
    const iv = setInterval(update, 60000)
    return () => clearInterval(iv)
  }, [nextAppt])

  // ── Cancel ───────────────────────────────────────────────────────────────
  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(backendUrl+'/api/user/cancel-appointment',{appointmentId},{headers:{token}})
      if (data.success) { toast.success(data.message); getUserAppointments(); getDoctorsData() }
      else toast.error(data.message)
    } catch (err) { toast.error(err.message) }
  }

  // ── Razorpay ─────────────────────────────────────────────────────────────
  const initPay = (order) => {
    new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount, currency: order.currency,
      name:'Appointment Payment', description:'Appointment Payment',
      order_id: order.id, receipt: order.receipt,
      handler: async (response) => {
        try {
          const { data } = await axios.post(backendUrl+'/api/user/verifyRazorpay',response,{headers:{token}})
          if (data.success) { navigate('/my-appointments'); getUserAppointments() }
        } catch (err) { toast.error(err.message) }
      }
    }).open()
  }
  const appointmentRazorpay = async (appointmentId) => {
    try {
      const { data } = await axios.post(backendUrl+'/api/user/payment-razorpay',{appointmentId},{headers:{token}})
      if (data.success) initPay(data.order)
      else toast.error(data.message)
    } catch (err) { toast.error(err.message) }
  }

  // ── Downloads ────────────────────────────────────────────────────────────
  const downloadBlob = async (url, filename, setLoading, id) => {
    setLoading(id)
    try {
      const res  = await axios.get(url,{headers:{token},responseType:'blob'})
      const link = document.createElement('a')
      link.href  = window.URL.createObjectURL(new Blob([res.data]))
      link.download = filename
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(link.href)
      toast.success('Downloaded!')
    } catch { toast.error('Download failed.') }
    finally { setLoading(null) }
  }
  const downloadInvoice      = (id) => downloadBlob(`${backendUrl}/api/user/invoice/${id}`,`Invoice-${id}.pdf`,setDownloadingInvoice,id)
  const downloadPrescription = (id) => downloadBlob(`${backendUrl}/api/prescription/download/${id}`,`Prescription-${id}.pdf`,setDownloadingRx,id)

  // ── View Rx ──────────────────────────────────────────────────────────────
  const viewPrescription = async (appt) => {
    setRxAppt(appt); setRxLoading(true); setRxModal(true); setRxList([])
    try {
      const { data } = await axios.get(`${backendUrl}/api/prescription/appointment/${appt._id}`,{headers:{token}})
      if (data.success) setRxList(data.prescriptions)
    } catch (e) { toast.error(e.message) }
    finally { setRxLoading(false) }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const filtered = appointments.filter(a => {
    if (activeTab==='upcoming')  return !a.cancelled && !a.isCompleted && minutesUntil(a.slotDate,a.slotTime)>0
    if (activeTab==='expired')   return !a.cancelled && !a.isCompleted && minutesUntil(a.slotDate,a.slotTime)<=0
    if (activeTab==='completed') return a.isCompleted
    if (activeTab==='cancelled') return a.cancelled
    return true
  })
  const counts = {
    all:       appointments.length,
    upcoming:  appointments.filter(a=>!a.cancelled&&!a.isCompleted&&minutesUntil(a.slotDate,a.slotTime)>0).length,
    completed: appointments.filter(a=>a.isCompleted).length,
    cancelled: appointments.filter(a=>a.cancelled).length,
    expired:   appointments.filter(a=>!a.cancelled&&!a.isCompleted&&minutesUntil(a.slotDate,a.slotTime)<=0).length,
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className='max-w-2xl mx-auto px-4 pb-10'>

      {/* ── Incoming call banner ── */}
      {incomingCall && (
        <div className='fixed top-4 right-4 left-4 sm:left-auto z-50 bg-white border border-violet-200
          rounded-2xl shadow-2xl p-4 flex items-center gap-3 sm:max-w-sm'>
          <div className='w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-xl flex-shrink-0'>📹</div>
          <div className='flex-1 min-w-0'>
            <p className='font-semibold text-gray-800 text-sm'>Incoming Video Call</p>
            <p className='text-xs text-gray-500 truncate'>Dr. {incomingCall.doctorName}</p>
          </div>
          <div className='flex gap-1.5 flex-shrink-0'>
            <button onClick={() => {
              const appt = appointments.find(a => a._id===incomingCall.appointmentId)
              setVideoCall({ appointmentId:incomingCall.appointmentId, userName:appt?.userData?.name||'Patient', meetLink:incomingCall.meetLink })
              setIncomingCall(null)
            }} className='bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium'>Join</button>
            <button onClick={() => setIncomingCall(null)} className='bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-lg'>✕</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className='mt-10 mb-5'>
        <h1 className='text-2xl font-bold text-gray-800'>My Appointments</h1>
        <p className='text-sm text-gray-400 mt-0.5'>{counts.all} total</p>
        {nextAppt && countdown && (
          <div className='mt-3 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 w-fit'>
            <span>⏰</span>
            <div>
              <p className='text-xs text-indigo-400 font-medium'>Next appointment in</p>
              <p className='text-sm font-bold text-indigo-600'>{countdown}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs — scrollable on mobile ── */}
      <div className='flex gap-1 mb-5 overflow-x-auto pb-1 scrollbar-hide'>
        {[
          {key:'all',      label:'All',       color:'text-gray-600'},
          {key:'upcoming', label:'Upcoming',  color:'text-blue-500'},
          {key:'completed',label:'Completed', color:'text-green-500'},
          {key:'cancelled',label:'Cancelled', color:'text-red-400'},
          {key:'expired',  label:'Expired',   color:'text-orange-400'},
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-xl transition-all
              ${activeTab===tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {tab.label}
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full
              ${activeTab===tab.key?'bg-white/20 text-white':'bg-white text-gray-400'}`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Cards ── */}
      <div className='flex flex-col gap-4'>
        {filtered.length === 0 && (
          <div className='text-center py-16 text-gray-400'>
            <p className='text-4xl mb-3'>📅</p>
            <p className='text-sm'>No {activeTab==='all'?'':activeTab} appointments</p>
          </div>
        )}

        {filtered.map((item, index) => (
          <div key={index} className={`rounded-2xl border overflow-hidden bg-white transition-all
            ${item.isCompleted?'border-green-200':'item.cancelled'?'border-red-100 opacity-75':'border-gray-200 hover:shadow-md'}`}>

            {/* color top bar */}
            {item.isCompleted && <div className='h-1 bg-gradient-to-r from-green-400 to-emerald-500'/>}
            {item.cancelled   && <div className='h-1 bg-red-300'/>}
            {!item.isCompleted && !item.cancelled && <div className='h-1 bg-gradient-to-r from-primary to-indigo-400'/>}

            <div className='p-4'>

              {/* ── Top row: image + info ── */}
              <div className='flex gap-3'>

                {/* Doctor image */}
                <div className='relative flex-shrink-0'>
                  <img
                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-[#EAEFFF]
                      ${item.cancelled?'grayscale opacity-60':''}`}
                    src={item.docData.image} alt={item.docData.name}
                  />
                  {item.isCompleted && (
                    <div className='absolute inset-0 rounded-xl bg-green-500/20 flex items-center justify-center'>
                      <div className='w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow'>
                        <span className='text-white text-sm font-bold'>✓</span>
                      </div>
                    </div>
                  )}
                  {item.cancelled && (
                    <div className='absolute inset-0 rounded-xl bg-red-500/10 flex items-center justify-center'>
                      <div className='w-8 h-8 rounded-full bg-red-400 flex items-center justify-center'>
                        <span className='text-white'>✕</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className='flex-1 min-w-0'>
                  <div className='flex flex-wrap items-center gap-1.5 mb-0.5'>
                    <p className='text-sm font-bold text-gray-800 truncate'>{item.docData.name}</p>
                    {item.consultationType==='video'
                      ? <span className='text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap'>📹 Video</span>
                      : <span className='text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap'>🏥 In-Person</span>
                    }
                    {item.payment && !item.cancelled && (
                      <span className='text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap'>Paid</span>
                    )}
                  </div>
                  <p className='text-xs text-gray-500 mb-1.5'>{item.docData.speciality}</p>

                  {/* Date + time */}
                  <div className='flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2.5 py-1.5 rounded-lg border w-fit mb-1.5'>
                    <span>📅</span>
                    <span className='font-medium'>{fmtDate(item.slotDate)}</span>
                    <span className='text-gray-300 mx-0.5'>|</span>
                    <span>🕐</span>
                    <span>{item.slotTime}</span>
                  </div>

                  {/* Status chip */}
                  {!item.cancelled && !item.isCompleted && (
                    item.status==='confirmed'
                      ? <span className='inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium'>✓ Confirmed</span>
                      : <span className='inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-medium'>⏳ Awaiting</span>
                  )}
                  {item.isCompleted && (
                    <span className='inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-600 border border-green-100 px-2 py-0.5 rounded-full font-medium'>✅ Completed</span>
                  )}
                  {item.cancelled && (
                    <span className='inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-500 border border-red-100 px-2 py-0.5 rounded-full font-medium'>🚫 Cancelled</span>
                  )}
                </div>
              </div>

              {/* ── Timeline ── */}
              <AppointmentTimeline item={item} />

              {/* ── Address ── */}
              <p className='text-xs text-gray-400 mt-2 truncate'>
                📍 {item.docData.address?.line1}{item.docData.address?.line2?`, ${item.docData.address.line2}`:''}
              </p>

              {/* ── Action buttons — full width grid on mobile ── */}
              <div className='mt-3 flex flex-wrap gap-2'>

                {/* Expired badge */}
                {!item.cancelled && !item.isCompleted && minutesUntil(item.slotDate,item.slotTime)<=0 && (
                  <div className='w-full py-2 px-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-500 text-xs font-medium flex items-center justify-center gap-1.5'>
                    <span>⌛</span><span>Appointment Expired</span>
                  </div>
                )}

                {/* Incoming call join */}
                {!item.cancelled && !item.isCompleted && item.status==='confirmed' && incomingCall?.appointmentId===item._id && (
                  <button onClick={() => {
                    setVideoCall({ appointmentId:item._id, userName:item.userData?.name||'Patient', meetLink:incomingCall?.meetLink })
                    setIncomingCall(null)
                  }} className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium bg-gradient-to-r from-violet-500 to-purple-600 text-white animate-pulse flex items-center justify-center gap-1.5'>
                    📹 Join Call
                  </button>
                )}

                {/* Pay Online */}
                {!item.cancelled && !item.payment && !item.isCompleted && minutesUntil(item.slotDate,item.slotTime)>0 && payment!==item._id && (
                  <button onClick={() => setPayment(item._id)}
                    className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium bg-primary text-white hover:bg-indigo-600 transition-all'>
                    💳 Pay Online
                  </button>
                )}

                {/* Razorpay */}
                {!item.cancelled && !item.payment && !item.isCompleted && minutesUntil(item.slotDate,item.slotTime)>0 && payment===item._id && (
                  <button onClick={() => appointmentRazorpay(item._id)}
                    className='flex-1 min-w-[120px] py-2 px-3 rounded-xl border flex items-center justify-center hover:bg-gray-50'>
                    <img className='h-5' src={assets.razorpay_logo} alt="Razorpay"/>
                  </button>
                )}

                {/* QR */}
                {!item.cancelled && item.status==='confirmed' && !item.isCompleted && (
                  <div className='flex-1 min-w-[120px]'>
                    <AppointmentQR appointment={item} userData={item.userData} />
                  </div>
                )}

                {/* Rate */}
                {item.isCompleted && !reviewed[item._id] && (
                  <button onClick={() => setReviewAppt(item)}
                    className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium border border-yellow-300 text-yellow-500 hover:bg-yellow-50 transition-all flex items-center justify-center gap-1'>
                    ⭐ Rate Doctor
                  </button>
                )}
                {item.isCompleted && reviewed[item._id] && (
                  <div className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs border border-yellow-100 text-yellow-400 flex items-center justify-center gap-1'>
                    ✓ Reviewed
                  </div>
                )}

                {/* Prescription */}
                {item.isCompleted && (
                  <>
                    <button onClick={() => viewPrescription(item)}
                      className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium border border-blue-200 text-blue-500 hover:bg-blue-50 transition-all'>
                      💊 View Rx
                    </button>
                    <button onClick={() => downloadPrescription(item._id)} disabled={downloadingRx===item._id}
                      className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium border border-indigo-200 text-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-50'>
                      {downloadingRx===item._id?'...':'📄 Download Rx'}
                    </button>
                  </>
                )}

                {/* Invoice */}
                {item.payment && (
                  <button onClick={() => downloadInvoice(item._id)} disabled={downloadingInvoice===item._id}
                    className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1'>
                    {downloadingInvoice===item._id?'...':'🧾 Invoice'}
                  </button>
                )}

                {/* Cancel */}
                {!item.cancelled && !item.isCompleted && isCancelable(item.slotDate,item.slotTime) && (
                  <button onClick={() => cancelAppointment(item._id)}
                    className='flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-medium border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400 transition-all'>
                    Cancel
                  </button>
                )}

              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Video Call Modal ── */}
      {videoCall && (
        <VideoCall
          appointmentId={videoCall.appointmentId}
          userName={videoCall.userName}
          role='patient'
          socket={socketRef.current}
          meetLink={videoCall.meetLink}
          onClose={() => setVideoCall(null)}
        />
      )}

      {/* ── Prescription Modal ── */}
      {rxModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between p-5 border-b'>
              <div>
                <p className='text-lg font-semibold text-gray-800'>Prescription</p>
                {rxAppt && <p className='text-sm text-gray-500'>Dr. {rxAppt.docData?.name} · {fmtDate(rxAppt.slotDate)}</p>}
              </div>
              <button onClick={() => setRxModal(false)} className='text-gray-400 hover:text-gray-600 text-xl'>✕</button>
            </div>
            <div className='p-5'>
              {rxLoading ? (
                <div className='flex justify-center py-12'>
                  <div className='w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin'/>
                </div>
              ) : rxList.length===0 ? (
                <div className='text-center py-10 text-gray-400'>
                  <p className='text-4xl mb-3'>💊</p>
                  <p className='text-sm'>No prescription added yet.</p>
                </div>
              ) : (
                <div className='flex flex-col gap-3'>
                  {rxList.map(p => (
                    <div key={p._id} className='border rounded-xl p-4 bg-gray-50'>
                      <p className='font-semibold text-gray-800'>{p.medicineName} <span className='text-primary text-sm font-normal'>{p.dosage}</span></p>
                      <p className='text-sm text-gray-500 mt-0.5'>{p.frequency} · {p.timing||'—'}</p>
                      <p className='text-xs text-gray-400 mt-1'>{p.durationDays} days · Ends {new Date(p.endDate).toLocaleDateString('en-IN')}</p>
                    </div>
                  ))}
                  <div className='bg-green-50 rounded-xl px-4 py-3 text-xs text-green-700'>
                    Daily reminders sent via SMS + email until course ends.
                  </div>
                </div>
              )}
            </div>
            {rxList.length>0 && (
              <div className='px-5 pb-5 flex gap-3'>
                <button onClick={() => setRxModal(false)} className='flex-1 py-2.5 border rounded-xl text-sm text-gray-600'>Close</button>
                <button onClick={() => { setRxModal(false); downloadPrescription(rxAppt._id) }} disabled={downloadingRx===rxAppt?._id}
                  className='flex-1 py-2.5 bg-primary text-white rounded-xl text-sm disabled:opacity-60'>
                  {downloadingRx===rxAppt?._id?'...':'Download PDF'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {reviewAppt && (
        <ReviewModal
          appointment={reviewAppt}
          onClose={() => setReviewAppt(null)}
          onSubmitted={() => {
            setReviewed(prev => ({...prev,[reviewAppt._id]:true}))
            getDoctorsData()
          }}
        />
      )}
    </div>
  )
}

export default MyAppointments