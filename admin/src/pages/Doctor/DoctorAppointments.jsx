import React, { useContext, useEffect, useState, useRef } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets'
import axios from 'axios'
import { toast } from 'react-toastify'
import { io } from 'socket.io-client'
import VideoCall from '../../components/VideoCall'

const emptyMed = () => ({ medicineName:'', dosage:'', frequency:'Once a day', timing:'After meals', durationDays:5 })
const FREQ   = ['Once a day','Twice a day','Three times a day','Four times a day','Every 8 hours','Every 6 hours','As needed']
const TIMING = ['Before meals','After meals','With meals','At bedtime','In the morning','Empty stomach']
const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmtDate = s => { if(!s) return ''; const [d,m,y]=s.split('_'); return `${d} ${MONTHS[+m]} ${y}` }

const DoctorAppointments = () => {
  const { dToken, appointments, getAppointments, cancelAppointment, completeAppointment, confirmAppointment, backendUrl } = useContext(DoctorContext)
  const { slotDateFormat, calculateAge, currency } = useContext(AppContext)
  const socketRef = useRef(null)

  const [modal,        setModal]        = useState(null)
  const [activeAppt,   setActiveAppt]   = useState(null)
  const [medicines,    setMedicines]    = useState([emptyMed()])
  const [existing,     setExisting]     = useState([])
  const [editIdx,      setEditIdx]      = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [videoCall,    setVideoCall]    = useState(null)
  const [editRow,      setEditRow]      = useState({})
  const [reassignAppt, setReassignAppt] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [reassigning,  setReassigning]  = useState(false)
  const [callDoneIds,  setCallDoneIds]  = useState([])

  useEffect(() => {
    if (!dToken || !backendUrl) return
    socketRef.current = io(backendUrl, { transports: ['websocket'] })
    return () => socketRef.current?.disconnect()
  }, [dToken, backendUrl])

  useEffect(() => { if (dToken) getAppointments() }, [dToken])

  const handleCallEnd = (appointmentId) => {
    setCallDoneIds(prev => [...new Set([...prev, appointmentId])])
    setVideoCall(null)
    toast.success('Video call ended - you can now mark the appointment as completed')
  }

  const handleComplete = (item) => {
    const isVideo  = item.consultationType === 'video'
    const callDone = callDoneIds.includes(item._id) || item.callCompleted
    if (isVideo && !callDone) { toast.error('Firstly complete the video call'); return }
    if (!isVideo && !item.checkedIn) { toast.error('Patient does not check in yet'); return }
    completeAppointment(item._id)
  }

  const fetchPrescriptions = async (apptId) => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/prescription/appointment/${apptId}`, { headers:{ dToken } })
      if (data.success) setExisting(data.prescriptions)
    } catch (e) { console.error(e) }
  }

  const openAdd  = async (appt) => { setActiveAppt(appt); await fetchPrescriptions(appt._id); setMedicines([emptyMed()]); setModal('add') }
  const openView = async (appt) => { setActiveAppt(appt); await fetchPrescriptions(appt._id); setEditIdx(null); setModal('view') }
  const updMed   = (i,k,v) => setMedicines(p => { const a=[...p]; a[i]={...a[i],[k]:v}; return a })
  const addRow   = () => setMedicines(p => [...p, emptyMed()])
  const remRow   = (i) => setMedicines(p => p.filter((_,j)=>j!==i))
  const closeModal = () => { setModal(null); setActiveAppt(null); setExisting([]); setEditIdx(null) }
  const startEdit  = (p,i) => { setEditRow({...p}); setEditIdx(i) }
  const updEdit    = (k,v) => setEditRow(p => ({...p,[k]:v}))

  const savePrescription = async () => {
    if (medicines.find(m => !m.medicineName.trim() || !m.dosage.trim())) return toast.error('Fill all fields')
    setSaving(true)
    try {
      const { data } = await axios.post(`${backendUrl}/api/prescription/add`, { appointmentId:activeAppt._id, medicines }, { headers:{dToken} })
      if (data.success) { toast.success('Saved!'); await fetchPrescriptions(activeAppt._id); setModal('view') }
      else toast.error(data.message)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const saveEdit = async (pres) => {
    setSaving(true)
    try {
      const { data } = await axios.put(`${backendUrl}/api/prescription/update/${pres._id}`,
        { medicineName:pres.medicineName, dosage:pres.dosage, frequency:pres.frequency, timing:pres.timing, durationDays:pres.durationDays },
        { headers:{dToken} })
      if (data.success) { toast.success('Updated!'); setEditIdx(null); await fetchPrescriptions(activeAppt._id) }
      else toast.error(data.message)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const deleteRow = async (presId) => {
    if (!window.confirm('Remove?')) return
    try {
      const { data } = await axios.delete(`${backendUrl}/api/prescription/delete/${presId}`, { headers:{dToken} })
      if (data.success) { toast.success('Removed'); await fetchPrescriptions(activeAppt._id) }
    } catch (e) { toast.error(e.message) }
  }

  const isExpired = (slotDate, slotTime) => {
    try {
      const [d,m,y] = slotDate.split('_')
      const [tp,per] = (slotTime||'').split(' ')
      const [hh,mm] = tp.split(':')
      let h = parseInt(hh)
      if (per==='PM'&&h!==12) h+=12
      if (per==='AM'&&h===12) h=0
      return new Date(+y,+m-1,+d,h,parseInt(mm)) < new Date()
    } catch { return false }
  }

  const getDoctorFreeSlots = () => {
    const freeSlots = [], today = new Date(), bookedMap = {}
    appointments.forEach(a => { if (!a.cancelled) { if (!bookedMap[a.slotDate]) bookedMap[a.slotDate]=[]; bookedMap[a.slotDate].push(a.slotTime) } })
    for (let i=1;i<=7;i++) {
      const d = new Date(today); d.setDate(today.getDate()+i)
      const date = `${d.getDate()}_${d.getMonth()+1}_${d.getFullYear()}`
      const booked = bookedMap[date]||[]
      for (let h=10;h<21;h++) for (const min of ['00','30']) {
        const period = h<12?'AM':'PM', displayH = h>12?h-12:h
        const time = `${displayH.toString().padStart(2,'0')}:${min} ${period}`
        if (!booked.includes(time)) freeSlots.push({ date, time, display:`${d.getDate()}/${d.getMonth()+1} ${time}` })
      }
    }
    return freeSlots.slice(0,20)
  }

  return (
    <div className='m-3 sm:m-5'>
      <p className='mb-3 text-lg font-semibold text-gray-800'>All Appointments</p>

      {/* ── Mobile card view ── */}
      <div className='flex flex-col gap-3 sm:hidden'>
        {appointments.map((item, index) => {
          const isVideo    = item.consultationType === 'video'
          const callDone   = callDoneIds.includes(item._id) || item.callCompleted
          const canComplete = isVideo ? callDone : item.checkedIn

          return (
            <div key={index} className='bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm'>
              <div className={`h-1 ${item.isCompleted?'bg-green-400':item.cancelled?'bg-red-300':'bg-primary'}`} />
              <div className='p-4'>
                {/* Top row */}
                <div className='flex items-center gap-3 mb-3'>
                  <img src={item.userData.image} className='w-10 h-10 rounded-full flex-shrink-0' alt="" />
                  <div className='flex-1 min-w-0'>
                    <p className='font-semibold text-gray-800 text-sm truncate'>{item.userData.name}</p>
                    <div className='flex flex-wrap gap-1 mt-0.5'>
                      <span className='text-[10px] text-gray-400'>{slotDateFormat(item.slotDate)}, {item.slotTime}</span>
                    </div>
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    {isVideo
                      ? <span className='text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full'>📹 Video</span>
                      : <span className='text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full'>🏥 In-Person</span>
                    }
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                      ${item.payment?'bg-green-100 text-green-600':'bg-gray-100 text-gray-500'}`}>
                      {item.payment?'Paid':'Cash'}
                    </span>
                  </div>
                </div>

                {/* Fee + age */}
                <div className='flex gap-2 mb-3'>
                  <span className='text-xs bg-gray-50 border rounded-lg px-2 py-1 text-gray-600'>{currency}{item.amount}</span>
                  <span className='text-xs bg-gray-50 border rounded-lg px-2 py-1 text-gray-600'>Age {calculateAge(item.userData.dob)}</span>
                </div>

                {/* Actions */}
                <div className='flex flex-wrap gap-2'>
                  {item.cancelled ? (
                    <span className='text-xs text-red-400 font-medium'>Cancelled by {item.cancelledBy||'User'}</span>
                  ) : item.isCompleted ? (
                    <>
                      <span className='text-xs text-green-500 font-semibold w-full'>✓ Completed</span>
                      <button onClick={() => openView(item)} className='flex-1 py-1.5 text-xs border border-blue-300 text-blue-500 rounded-lg hover:bg-blue-50'>View Rx</button>
                      <button onClick={() => openAdd(item)}  className='flex-1 py-1.5 text-xs border border-primary text-primary rounded-lg hover:bg-primary hover:text-white'>+ Edit Rx</button>
                    </>
                  ) : isExpired(item.slotDate, item.slotTime) ? (
                    <>
                      <span className='text-xs text-orange-500 font-semibold w-full'>⌛ Expired</span>
                      <button onClick={() => setReassignAppt(item)} className='flex-1 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600'>🔄 Reassign</button>
                    </>
                  ) : item.status === 'confirmed' ? (
                    <>
                      <span className='text-xs text-blue-500 font-semibold w-full'>✓ Confirmed</span>
                      {isVideo && (
                        <button onClick={() => setVideoCall({ appointmentId:item._id, userName:`Dr. ${item.docData?.name||'Doctor'}` })}
                          className='flex-1 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600'>
                          📹 {callDone?'Rejoin':'Start Call'}
                        </button>
                      )}
                      <button onClick={() => handleComplete(item)} disabled={!canComplete}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-all
                          ${canComplete?'bg-green-500 text-white hover:bg-green-600':'bg-gray-100 text-gray-400 opacity-60'}`}>
                        {canComplete?'✓ Complete':'🔒 Complete'}
                      </button>
                      <button onClick={() => cancelAppointment(item._id)} className='flex-1 py-1.5 text-xs border border-red-200 text-red-400 rounded-lg hover:bg-red-50'>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className='text-[10px] text-amber-500 font-semibold uppercase w-full'>Pending</span>
                      {isVideo && !item.payment ? (
                        <span className='text-xs text-red-400 font-semibold'>Payment Pending</span>
                      ) : (
                        <button onClick={() => confirmAppointment(item._id)} className='flex-1 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600'>Confirm</button>
                      )}
                      <button onClick={() => cancelAppointment(item._id)} className='flex-1 py-1.5 text-xs border border-red-200 text-red-400 rounded-lg hover:bg-red-50'>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table view ── */}
      <div className='hidden sm:block bg-white border rounded-xl overflow-hidden'>
        <div className='grid grid-cols-[0.5fr_2fr_1fr_1fr_3fr_1fr_1fr] gap-1 py-3 px-6 border-b text-xs font-medium text-gray-400 uppercase tracking-wide'>
          <p>#</p><p>Patient</p><p>Payment</p><p>Age</p><p>Date & Time</p><p>Fees</p><p>Action</p>
        </div>

        <div className='max-h-[70vh] overflow-y-auto'>
          {appointments.map((item, index) => {
            const isVideo    = item.consultationType === 'video'
            const callDone   = callDoneIds.includes(item._id) || item.callCompleted
            const canComplete = isVideo ? callDone : item.checkedIn

            return (
              <div key={index} className='grid grid-cols-[0.5fr_2fr_1fr_1fr_3fr_1fr_1fr] gap-1 items-center text-gray-500 py-3 px-6 border-b hover:bg-gray-50 text-sm'>
                <p>{index+1}</p>
                <div className='flex items-center gap-2'>
                  <img src={item.userData.image} className='w-8 rounded-full flex-shrink-0' alt="" />
                  <div>
                    <p className='text-gray-800 text-xs font-medium'>{item.userData.name}</p>
                    {isVideo
                      ? <span className='text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full'>📹 Video</span>
                      : <span className='text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full'>🏥 In-Person</span>
                    }
                  </div>
                </div>
                <div><span className='text-xs border border-primary px-2 rounded-full'>{item.payment?'Paid':'Cash'}</span></div>
                <p>{calculateAge(item.userData.dob)}</p>
                <p className='text-xs'>{slotDateFormat(item.slotDate)}, {item.slotTime}</p>
                <p>{currency}{item.amount}</p>

                {/* Action */}
                {item.cancelled ? (
                  <div><p className='text-red-400 text-xs font-medium'>Cancelled</p><p className='text-[10px] text-gray-400'>by {item.cancelledBy||'User'}</p></div>
                ) : item.isCompleted ? (
                  <div className='flex flex-col gap-1'>
                    <p className='text-green-500 text-xs font-semibold'>✓ Completed</p>
                    <button onClick={() => openView(item)} className='text-xs border border-blue-400 text-blue-500 rounded px-2 py-1 hover:bg-blue-50'>View Rx</button>
                    <button onClick={() => openAdd(item)}  className='text-xs border border-primary text-primary rounded px-2 py-1 hover:bg-primary hover:text-white'>+ Edit Rx</button>
                  </div>
                ) : isExpired(item.slotDate, item.slotTime) ? (
                  <div className='flex flex-col gap-1'>
                    <span className='text-xs text-orange-500 font-semibold'>⌛ Expired</span>
                    <button onClick={() => setReassignAppt(item)} className='text-xs bg-orange-500 text-white px-2 py-1.5 rounded-lg hover:bg-orange-600'>🔄 Reassign</button>
                  </div>
                ) : item.status === 'confirmed' ? (
                  <div className='flex flex-col gap-1'>
                    <span className='text-xs text-blue-500 font-semibold'>✓ Confirmed</span>
                    {isVideo && (
                      <button onClick={() => setVideoCall({ appointmentId:item._id, userName:`Dr. ${item.docData?.name||'Doctor'}` })}
                        className='text-xs bg-violet-500 text-white px-2 py-1 rounded-lg hover:bg-violet-600 flex items-center gap-1 justify-center'>
                        📹 {callDone?'Rejoin':'Start Call'}
                      </button>
                    )}
                    <button onClick={() => handleComplete(item)} disabled={!canComplete}
                      title={!canComplete?(isVideo?'Call required':'Check-in required'):'Complete'}
                      className={`text-xs px-2 py-1 rounded-lg flex items-center justify-center gap-1
                        ${canComplete?'bg-green-500 text-white hover:bg-green-600 cursor-pointer':'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'}`}>
                      {canComplete?'✓ Complete':'🔒 Complete'}
                    </button>
                    {isVideo && !callDone && <p className='text-[10px] text-amber-500 text-center'>Call required first</p>}
                    <img onClick={() => cancelAppointment(item._id)} className='w-8 cursor-pointer' src={assets.cancel_icon} alt="cancel" />
                  </div>
                ) : (
                  <div className='flex flex-col gap-1'>
                    <span className='text-[10px] text-amber-500 font-semibold uppercase'>Pending</span>
                    <div className='flex gap-1'>
                      {isVideo && !item.payment ? (
                        <span className='text-[10px] text-red-400 font-semibold'>Payment Pending</span>
                      ) : (
                        <button onClick={() => confirmAppointment(item._id)} className='text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600'>Confirm</button>
                      )}
                      <img onClick={() => cancelAppointment(item._id)} className='w-8 cursor-pointer' src={assets.cancel_icon} alt="cancel" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Video Call */}
      {videoCall && (
        <VideoCall appointmentId={videoCall.appointmentId} userName={videoCall.userName} role='doctor'
          socket={socketRef.current} onClose={() => setVideoCall(null)} onCallEnd={handleCallEnd}
          backendUrl={backendUrl} dToken={dToken} />
      )}

      {/* View Prescription Modal */}
      {modal === 'view' && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between p-5 border-b'>
              <div>
                <p className='text-lg font-semibold'>Prescription</p>
                <p className='text-sm text-gray-500'>{activeAppt?.userData?.name} — {fmtDate(activeAppt?.slotDate)}</p>
              </div>
              <div className='flex items-center gap-3'>
                <button onClick={() => setModal('add')} className='text-sm border border-primary text-primary px-4 py-1.5 rounded-lg hover:bg-primary hover:text-white'>+ Add / Replace</button>
                <button onClick={closeModal} className='text-gray-400 text-xl'>✕</button>
              </div>
            </div>
            <div className='p-5'>
              {existing.length === 0 ? (
                <div className='text-center py-10 text-gray-400'>
                  <p className='text-4xl mb-3'>💊</p><p>No prescription added yet.</p>
                  <button onClick={() => setModal('add')} className='mt-4 bg-primary text-white px-6 py-2 rounded-xl text-sm'>Add Prescription</button>
                </div>
              ) : (
                <div className='flex flex-col gap-3'>
                  {existing.map((p,i) => (
                    <div key={p._id} className='border rounded-xl p-4 bg-gray-50'>
                      {editIdx===i ? (
                        <div>
                          <p className='text-xs font-medium text-primary mb-3'>Editing medicine {i+1}</p>
                          <div className='grid grid-cols-2 gap-3'>
                            {[{label:'Medicine name',key:'medicineName',ph:'e.g. Paracetamol'},{label:'Dosage',key:'dosage',ph:'e.g. 500mg'}].map(f=>(
                              <div key={f.key}>
                                <label className='text-xs text-gray-500'>{f.label}</label>
                                <input value={editRow[f.key]||''} onChange={e=>updEdit(f.key,e.target.value)} placeholder={f.ph} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'/>
                              </div>
                            ))}
                            <div><label className='text-xs text-gray-500'>Frequency</label>
                              <select value={editRow.frequency||''} onChange={e=>updEdit('frequency',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'>{FREQ.map(f=><option key={f}>{f}</option>)}</select>
                            </div>
                            <div><label className='text-xs text-gray-500'>Timing</label>
                              <select value={editRow.timing||''} onChange={e=>updEdit('timing',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'>{TIMING.map(t=><option key={t}>{t}</option>)}</select>
                            </div>
                            <div><label className='text-xs text-gray-500'>Duration (days)</label>
                              <input type='number' min='1' max='365' value={editRow.durationDays||5} onChange={e=>updEdit('durationDays',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'/>
                            </div>
                          </div>
                          <div className='flex gap-2 mt-3'>
                            <button onClick={()=>saveEdit(editRow)} disabled={saving} className='flex-1 py-2 bg-primary text-white rounded-lg text-sm disabled:opacity-60'>{saving?'Saving...':'Save'}</button>
                            <button onClick={()=>setEditIdx(null)} className='flex-1 py-2 border rounded-lg text-sm text-gray-600'>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex items-start justify-between gap-3'>
                          <div className='flex-1'>
                            <p className='font-semibold text-gray-800'>{p.medicineName} <span className='text-primary'>{p.dosage}</span></p>
                            <p className='text-sm text-gray-500 mt-0.5'>{p.frequency} · {p.timing||'—'} · {p.durationDays} days</p>
                            <p className='text-xs text-gray-400 mt-1'>Ends: {new Date(p.endDate).toLocaleDateString('en-IN')}</p>
                          </div>
                          <div className='flex gap-2'>
                            <button onClick={()=>startEdit(p,i)} className='text-xs border border-amber-400 text-amber-600 px-3 py-1 rounded-lg'>Edit</button>
                            <button onClick={()=>deleteRow(p._id)} className='text-xs border border-red-400 text-red-500 px-3 py-1 rounded-lg'>Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Prescription Modal */}
      {modal === 'add' && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <div className='flex items-center justify-between p-5 border-b'>
              <div>
                <p className='text-lg font-semibold'>{existing.length>0?'Replace prescription':'Add prescription'}</p>
                <p className='text-sm text-gray-500'>{activeAppt?.userData?.name}</p>
              </div>
              <button onClick={()=>existing.length>0?setModal('view'):closeModal()} className='text-gray-400 text-xl'>✕</button>
            </div>
            <div className='p-5 flex flex-col gap-4'>
              {medicines.map((med,idx) => (
                <div key={idx} className='border rounded-xl p-4 bg-gray-50 relative'>
                  {medicines.length>1 && <button onClick={()=>remRow(idx)} className='absolute top-3 right-3 text-red-400 text-xs'>Remove</button>}
                  <p className='text-xs font-medium text-primary mb-3'>Medicine {idx+1}</p>
                  <div className='grid grid-cols-2 gap-3'>
                    <div><label className='text-xs text-gray-500'>Medicine name *</label>
                      <input value={med.medicineName} onChange={e=>updMed(idx,'medicineName',e.target.value)} placeholder='e.g. Paracetamol' className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'/>
                    </div>
                    <div><label className='text-xs text-gray-500'>Dosage *</label>
                      <input value={med.dosage} onChange={e=>updMed(idx,'dosage',e.target.value)} placeholder='e.g. 500mg' className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'/>
                    </div>
                    <div><label className='text-xs text-gray-500'>Frequency</label>
                      <select value={med.frequency} onChange={e=>updMed(idx,'frequency',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'>{FREQ.map(f=><option key={f}>{f}</option>)}</select>
                    </div>
                    <div><label className='text-xs text-gray-500'>Timing</label>
                      <select value={med.timing} onChange={e=>updMed(idx,'timing',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'>{TIMING.map(t=><option key={t}>{t}</option>)}</select>
                    </div>
                    <div><label className='text-xs text-gray-500'>Duration (days)</label>
                      <input type='number' min='1' max='365' value={med.durationDays} onChange={e=>updMed(idx,'durationDays',e.target.value)} className='w-full mt-1 border rounded-lg px-3 py-2 text-sm'/>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addRow} className='border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-primary hover:text-primary'>+ Add another medicine</button>
            </div>
            <div className='flex gap-3 px-5 pb-5'>
              <button onClick={()=>existing.length>0?setModal('view'):closeModal()} className='flex-1 py-2.5 border rounded-xl text-sm text-gray-600'>Back</button>
              <button onClick={savePrescription} disabled={saving} className='flex-1 py-2.5 bg-primary text-white rounded-xl text-sm disabled:opacity-60'>{saving?'Saving...':'Save & activate reminders'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {reassignAppt && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-md p-6'>
            <div className='flex justify-between items-center mb-4'>
              <div>
                <p className='text-lg font-bold text-gray-800'>Reassign Slot</p>
                <p className='text-sm text-gray-500'>Patient: {reassignAppt.userData?.name}</p>
              </div>
              <button onClick={() => { setReassignAppt(null); setSelectedSlot(null) }} className='text-gray-400 text-xl'>✕</button>
            </div>
            <p className='text-sm font-medium text-gray-600 mb-3'>Select a new slot:</p>
            <div className='grid grid-cols-2 gap-2 max-h-52 overflow-y-auto mb-4'>
              {getDoctorFreeSlots().map((slot,i) => (
                <button key={i} onClick={() => setSelectedSlot(slot)}
                  className={`text-xs py-2 px-3 rounded-lg border text-left transition-all
                    ${selectedSlot?.date===slot.date&&selectedSlot?.time===slot.time?'bg-primary text-white border-primary':'border-gray-200 text-gray-600 hover:border-primary'}`}>
                  📅 {slot.display}
                </button>
              ))}
            </div>
            {selectedSlot && <div className='bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-700'>New: <strong>{selectedSlot.display}</strong></div>}
            <div className='flex gap-3'>
              <button onClick={() => { setReassignAppt(null); setSelectedSlot(null) }} className='flex-1 py-2.5 border rounded-xl text-sm text-gray-500'>Cancel</button>
              <button disabled={!selectedSlot||reassigning}
                onClick={async () => {
                  if (!selectedSlot) return
                  setReassigning(true)
                  try {
                    const { data } = await axios.post(`${backendUrl}/api/doctor/reassign-slot`,
                      { appointmentId:reassignAppt._id, newSlotDate:selectedSlot.date, newSlotTime:selectedSlot.time },
                      { headers:{dToken} })
                    if (data.success) { toast.success('Slot reassigned!'); setReassignAppt(null); setSelectedSlot(null); getAppointments() }
                    else toast.error(data.message)
                  } catch (err) { toast.error(err.message) }
                  finally { setReassigning(false) }
                }}
                className='flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-indigo-600'>
                {reassigning?'Reassigning...':'✅ Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorAppointments