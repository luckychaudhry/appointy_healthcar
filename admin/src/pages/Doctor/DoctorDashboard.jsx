import React, { useContext, useEffect, useState, useRef } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { assets } from '../../assets/assets'
import { AppContext } from '../../context/AppContext'
import VideoCall from '../../components/VideoCall'
import { io } from 'socket.io-client'

const DoctorDashboard = () => {
  const { dToken, dashData, getDashData, cancelAppointment, completeAppointment, confirmAppointment, backendUrl } = useContext(DoctorContext)
  const { slotDateFormat, currency } = useContext(AppContext)

  const [videoCall,   setVideoCall]   = useState(null)
  const [callDoneIds, setCallDoneIds] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    getDashData()
    if (!dToken || !backendUrl) return
    socketRef.current = io(backendUrl, { transports: ['websocket'] })
    return () => socketRef.current?.disconnect()
  }, [dToken, backendUrl])

  const handleCallEnd = (appointmentId) => {
    setCallDoneIds(prev => [...new Set([...prev, appointmentId])])
    setVideoCall(null)
  }

  const handleComplete = (item) => {
    const isVideo  = item.consultationType === 'video'
    const callDone = callDoneIds.includes(item._id) || item.callCompleted
    if (isVideo && !callDone) { alert('Pehle video call complete karo'); return }
    if (!isVideo && !item.checkedIn) { alert('Patient check-in nahi hua abhi'); return }
    completeAppointment(item._id)
  }

  return dashData && (
    <div className='m-3 sm:m-5'>

      {/* Stats */}
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6'>
        {[
          { icon: assets.earning_icon,      value: `${currency} ${dashData.earnings}`, label: 'Earnings' },
          { icon: assets.appointments_icon, value: dashData.appointments,              label: 'Appointments' },
          { icon: assets.patients_icon,     value: dashData.patients,                  label: 'Patients' },
        ].map((s, i) => (
          <div key={i} className='flex items-center gap-2 bg-white p-3 sm:p-4 rounded-xl border-2 border-gray-100 hover:scale-105 transition-all'>
            <img className='w-10 sm:w-14' src={s.icon} alt="" />
            <div>
              <p className='text-base sm:text-xl font-semibold text-gray-600 truncate'>{s.value}</p>
              <p className='text-xs text-gray-400'>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Latest Bookings */}
      <div className='bg-white rounded-xl border overflow-hidden'>
        <div className='flex items-center gap-2 px-4 py-3 border-b'>
          <img src={assets.list_icon} alt="" className='w-5' />
          <p className='font-semibold text-sm'>Latest Bookings</p>
        </div>

        <div>
          {dashData.latestAppointments.slice(0, 5).map((item, index) => {
            const isVideo    = item.consultationType === 'video'
            const callDone   = callDoneIds.includes(item._id) || item.callCompleted
            const canComplete = isVideo ? callDone : item.checkedIn

            return (
              <div key={index} className='flex items-start px-4 py-3 gap-3 border-b last:border-0 hover:bg-gray-50'>
                <img className='rounded-full w-9 h-9 flex-shrink-0 mt-0.5' src={item.userData.image} alt="" />

                {/* Info */}
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-gray-800 truncate'>{item.userData.name}</p>
                  <div className='flex flex-wrap items-center gap-1 mt-0.5'>
                    <p className='text-xs text-gray-500'>{slotDateFormat(item.slotDate)}</p>
                    {isVideo
                      ? <span className='text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full'>📹 Video</span>
                      : <span className='text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full'>🏥 In-Person</span>
                    }
                  </div>

                  {/* Actions below info on mobile */}
                  <div className='flex flex-wrap gap-1.5 mt-2'>
                    {item.cancelled ? (
                      <span className='text-[10px] text-red-400 font-medium'>Cancelled by {item.cancelledBy||'User'}</span>
                    ) : item.isCompleted ? (
                      <span className='text-[10px] text-green-500 font-medium'>✓ Completed</span>
                    ) : item.status === 'confirmed' ? (
                      <>
                        <span className='text-[10px] text-blue-500 font-semibold'>✓ Confirmed</span>
                        {isVideo && (
                          <button onClick={() => setVideoCall({ appointmentId:item._id, userName:`Dr. ${item.docData?.name}` })}
                            className='text-[10px] bg-violet-500 text-white px-2 py-1 rounded-lg hover:bg-violet-600'>
                            📹 {callDone?'Rejoin':'Start Call'}
                          </button>
                        )}
                        <button onClick={() => handleComplete(item)} disabled={!canComplete}
                          title={!canComplete ? (isVideo?'Call required':'Check-in required') : 'Complete'}
                          className={`text-[10px] px-2 py-1 rounded-lg transition-all
                            ${canComplete?'bg-green-500 text-white hover:bg-green-600':'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'}`}>
                          {canComplete?'✓ Complete':'🔒 Complete'}
                        </button>
                        <button onClick={() => cancelAppointment(item._id)}
                          className='text-[10px] border border-red-200 text-red-400 px-2 py-1 rounded-lg hover:bg-red-50'>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className='text-[10px] text-amber-500 font-semibold uppercase'>Pending</span>
                        {isVideo && !item.payment ? (
                          <span className='text-[10px] text-red-400 font-semibold'>Payment Pending</span>
                        ) : (
                          <button onClick={() => confirmAppointment(item._id)}
                            className='text-[10px] bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600'>
                            Confirm
                          </button>
                        )}
                        <button onClick={() => cancelAppointment(item._id)}
                          className='text-[10px] border border-red-200 text-red-400 px-2 py-1 rounded-lg hover:bg-red-50'>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Video Call */}
      {videoCall && (
        <VideoCall
          appointmentId={videoCall.appointmentId}
          userName={videoCall.userName}
          role='doctor'
          socket={socketRef.current}
          onClose={() => setVideoCall(null)}
          onCallEnd={handleCallEnd}
          backendUrl={backendUrl}
          dToken={dToken}
        />
      )}
    </div>
  )
}

export default DoctorDashboard