import React, { useContext, useEffect, useState } from 'react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { toast } from 'react-toastify'
import axios from 'axios'

const DoctorProfile = () => {
  const { dToken, profileData, setProfileData, getProfileData, backendUrl } = useContext(DoctorContext)
  const { currency } = useContext(AppContext)
  const [isEdit, setIsEdit] = useState(false)

  const updateProfile = async () => {
    try {
      const { data } = await axios.post(
        backendUrl + '/api/doctor/update-profile',
        { address:profileData.address, fees:profileData.fees, about:profileData.about, available:profileData.available },
        { headers: { dToken } }
      )
      if (data.success) { toast.success(data.message); setIsEdit(false); getProfileData() }
      else toast.error(data.message)
    } catch (error) { toast.error(error.message) }
  }

  useEffect(() => { if (dToken) getProfileData() }, [dToken])

  return profileData && (
    <div className='m-3 sm:m-5 max-w-2xl'>

      {/* Doctor image */}
      <div className='bg-white rounded-2xl border overflow-hidden mb-4'>
        <div className='bg-primary/10 p-4 flex items-center gap-4'>
          <img className='w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-cover border-4 border-white shadow-md' src={profileData.image} alt="" />
          <div>
            <p className='text-lg sm:text-2xl font-bold text-gray-800'>{profileData.name}</p>
            <p className='text-sm text-gray-500'>{profileData.degree} · {profileData.speciality}</p>
            <span className='inline-block mt-1 text-xs border border-primary text-primary px-2 py-0.5 rounded-full'>{profileData.experience}</span>
          </div>
        </div>

        <div className='p-4 sm:p-6 flex flex-col gap-4'>

          {/* About */}
          <div>
            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'>About</p>
            {isEdit
              ? <textarea
                  onChange={e => setProfileData(prev => ({...prev, about:e.target.value}))}
                  value={profileData.about}
                  rows={5}
                  className='w-full border rounded-xl px-3 py-2 text-sm text-gray-700 outline-primary resize-none'
                />
              : <p className='text-sm text-gray-600 leading-relaxed'>{profileData.about}</p>
            }
          </div>

          {/* Fees */}
          <div>
            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'>Appointment Fee</p>
            {isEdit
              ? <div className='flex items-center gap-2'>
                  <span className='text-sm text-gray-500'>{currency}</span>
                  <input
                    type='number'
                    value={profileData.fees}
                    onChange={e => setProfileData(prev => ({...prev, fees:e.target.value}))}
                    className='border rounded-xl px-3 py-2 text-sm outline-primary w-32'
                  />
                </div>
              : <p className='text-sm font-semibold text-gray-800'>{currency} {profileData.fees}</p>
            }
          </div>

          {/* Address */}
          <div>
            <p className='text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'>Address</p>
            {isEdit
              ? <div className='flex flex-col gap-2'>
                  <input
                    type='text'
                    value={profileData.address.line1}
                    onChange={e => setProfileData(prev => ({...prev, address:{...prev.address, line1:e.target.value}}))}
                    placeholder='Line 1'
                    className='border rounded-xl px-3 py-2 text-sm outline-primary'
                  />
                  <input
                    type='text'
                    value={profileData.address.line2}
                    onChange={e => setProfileData(prev => ({...prev, address:{...prev.address, line2:e.target.value}}))}
                    placeholder='Line 2'
                    className='border rounded-xl px-3 py-2 text-sm outline-primary'
                  />
                </div>
              : <p className='text-sm text-gray-600'>{profileData.address.line1}<br/>{profileData.address.line2}</p>
            }
          </div>

          {/* Available toggle */}
          <div className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl'>
            <div
              onClick={() => isEdit && setProfileData(prev => ({...prev, available:!prev.available}))}
              className={`w-11 h-6 rounded-full transition-all relative cursor-pointer
                ${profileData.available ? 'bg-green-500' : 'bg-gray-300'}
                ${!isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow
                ${profileData.available ? 'left-5' : 'left-0.5'}`} />
            </div>
            <div>
              <p className='text-sm font-medium text-gray-700'>Available for Appointments</p>
              <p className='text-xs text-gray-400'>{profileData.available ? 'Patients can book slots' : 'Currently unavailable'}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className='flex gap-3 pt-2'>
            {isEdit ? (
              <>
                <button onClick={updateProfile}
                  className='flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-all'>
                  Save Changes
                </button>
                <button onClick={() => { setIsEdit(false); getProfileData() }}
                  className='flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-all'>
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => setIsEdit(true)}
                className='flex-1 py-2.5 border border-primary text-primary rounded-xl text-sm font-medium hover:bg-primary hover:text-white transition-all'>
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DoctorProfile