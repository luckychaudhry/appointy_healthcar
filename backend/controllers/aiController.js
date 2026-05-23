import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const symptomChecker = async (req, res) => {
  try {
    const { symptoms } = req.body;

    if (!symptoms) {
      return res.json({ success: false, message: "Symptoms required" });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview" // ✅ FINAL FIX
    });

    const prompt = `
User symptoms: ${symptoms}

From below specialities choose ONLY ONE:

- General physician
- Gynecologist
- Dermatologist
- Pediatricians
- Neurologist
- Gastroenterologist

Reply ONLY with speciality name with bold letter and then start with next line with heading "Possible reason of" then symptom overview and take a line break: suggest possible reason of the symptoms and then suggest to book an appointment with speciality doctor. Do not reply anything else except speciality, reason and suggestion to book appointment. and reply in the language of user
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    res.json({
      success: true,
      aiResponse: response
    });

  } catch (error) {
    console.log(error);
    res.json({
      success: false,
      message: error.message
    });
  }
};