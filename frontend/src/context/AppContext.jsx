import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from 'axios'



// AppContext.jsx mein add karo — token ke saath
// import { io } from 'socket.io-client'

// // useEffect mein
// useEffect(() => {
//   if (!token || !backendUrl) return
  
//   const socket = io(backendUrl, { transports: ['websocket'] })
  
//   socket.on('call:incoming', ({ appointmentId, doctorName, meetLink }) => {
//     // Global notification — kisi bhi page pe dikhe
//     toast.info(
//       <div>
//         <p style={{fontWeight:600}}>📹 Dr. {doctorName} has started the call!</p>
//         <button
//           onClick={() => {
//             window.location.href = '/my-appointments'
//           }}
//           style={{
//             background:'#5F6FFF', color:'#fff', border:'none',
//             borderRadius:8, padding:'4px 12px', marginTop:6,
//             cursor:'pointer', fontSize:12
//           }}
//         >
//           Go to Appointments →
//         </button>
//       </div>,
//       { autoClose: false, toastId: 'global-call' }
//     )
//   })

//   socket.on('call:ended', () => {
//     toast.dismiss('global-call')
//   })

//   return () => socket.disconnect()
// }, [token, backendUrl])

export const AppContext = createContext()

const AppContextProvider = (props) => {
    const currencySymbol = '₹'
    const backendUrl = import.meta.env.VITE_BACKEND_URL

    const [doctors, setDoctors] = useState([])
    const [token, setToken] = useState(localStorage.getItem('token') || '')
    const [userData, setUserData] = useState(false)

    const getDoctorsData = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/doctor/list')
            if (data.success) {
                setDoctors(data.doctors)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }
    useEffect(() => {
  // Initial load
  getDoctorsData()
 
  // Auto-refresh har 30 seconds — slot availability live rakhta hai
  const interval = setInterval(() => {
    getDoctorsData()
  }, 5000)
 
  return () => clearInterval(interval)
}, [])


    const loadUserProfileData = async () => {
        try {
            const { data } = await axios.get(backendUrl + '/api/user/get-profile', {
                headers: { token }
            })

            if (data.success) {
                const safeUserData = {
                    ...data.userData,
                    address: data.userData.address || { line1: '', line2: '' },
                    gender: data.userData.gender || '',
                    dob: data.userData.dob || ''
                }
                setUserData(safeUserData)
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.log(error)
            toast.error(error.message)
        }
    }

    

    useEffect(() => {
        if (token) {
            loadUserProfileData()
             // Auto-refresh har 30 seconds — slot availability live rakhta hai
  const interval = setInterval(() => {
    loadUserProfileData()
  }, 5000)
 
  return () => clearInterval(interval)
        }
    }, [token])

    const value = {
        doctors, getDoctorsData,
        currencySymbol,
        backendUrl,
        token, setToken,
        userData, setUserData, loadUserProfileData
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
