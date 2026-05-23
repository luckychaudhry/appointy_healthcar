import React, { useContext, useEffect } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { toast } from "react-toastify";
import axios from "axios";
import { AppContext } from "../../context/AppContext";
const DoctorsList = () => {

  const { doctors , aToken , getAllDoctors, changeAvailability, removeDoctor,backendUrl  } = useContext(AdminContext)

  useEffect(() => {
    if (aToken) {
        getAllDoctors()
    }
}, [aToken])
  
  return (
    <div className='m-5 max-h-[90vh] overflow-y-scroll'>
      <h1 className='text-lg font-medium'>All Doctors</h1>
      <div className='w-full flex flex-wrap gap-4 pt-5 gap-y-6'>
        {doctors.map((item, index) => (
          <div className='border border-[#C9D8FF] rounded-xl max-w-56 overflow-hidden cursor-pointer group' key={index}>
            <img className='bg-[#EAEFFF] group-hover:bg-primary transition-all duration-500' src={item.image} alt="" />
            <div className='p-4'>
              <p className='text-[#262626] text-lg font-medium'>{item.name}</p>
              <p className='text-[#5C5C5C] text-sm'>{item.speciality}</p>
              <div className='mt-2 flex items-center gap-1 text-sm'>
                <input onChange={()=>changeAvailability(item._id)} type="checkbox" checked={item.available} />
                <p>Available</p>
              </div>
            </div>
            
            <button
                      onClick={async () => {
  const confirmDelete = window.confirm("Are you sure you want to remove this doctor?");
  if (!confirmDelete) return;

  try {
    
    const { data } = await axios.post(
      backendUrl + "/api/admin/remove-doctor", // ✅ correct route
      { docId: item._id },
      { headers: { aToken } }
    );

    if (data.success) {
      toast.success(data.message);

      // ✅ UI refresh
      getAllDoctors();   // 👈 ye use kar (important)
      
    } else {
      toast.error(data.message);
    }
  } catch (error) {
    console.log(error);
    toast.error("Something went wrong");
  }
  
}}
className="mt-auto w-full bg-red-500 text-white px-3 py-1 rounded"
>
Remove
</button>
          </div>
         
        ))}
      </div>
    </div>
  )
}

export default DoctorsList