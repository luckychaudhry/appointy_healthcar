// import React, { useState } from "react";
// import axios from "axios";
// import { toast } from "react-toastify";

// const SymptomChecker = () => {
//   const [symptoms, setSymptoms] = useState("");
//   const [result, setResult] = useState("");
//   const backendUrl = import.meta.env.VITE_BACKEND_URL;

//   const checkSymptoms = async () => {
//     if (!symptoms) return toast.error("Enter symptoms");

//     try {
//       const { data } = await axios.post(
//         backendUrl + "/api/ai/symptom-check",
//         { symptoms }
//       );

//       if (data.success) {
//         setResult(data.aiResponse);
//       } else {
//         toast.error(data.message);
//       }
//     } catch (err) {
//       toast.error("AI error");
//     }
//   };

//   return (
//     <div className="max-w-xl mx-auto mt-10 p-6 border rounded">
//       <h2 className="text-xl font-semibold mb-3">
//         AI Symptom Checker
//       </h2>

//       <textarea
//         value={symptoms}
//         onChange={(e) => setSymptoms(e.target.value)}
//         placeholder="Enter your symptoms..."
//         className="w-full border p-2 rounded"
//         rows={4}
//       />

//       <button
//         onClick={checkSymptoms}
//         className="bg-primary text-white px-6 py-2 rounded mt-3"
//       >
//         Check
//       </button>

//       {result && (
//         <div className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-line">
//           {result}
//         </div>
//       )}
//     </div>
//   );
// };

// export default SymptomChecker;