// ── backend/controllers/reportAnalyzerController.js ──────────────────────────
// Gemini Vision se PDF/Image analyze karo aur doctor suggest karo
// Install: npm install @google/generative-ai multer

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Helper: file ko base64 mein convert karo ──────────────────────────────────
const fileToBase64 = (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString("base64");
};

// ── Helper: MIME type detect karo ─────────────────────────────────────────────
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    ".pdf":  "application/pdf",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return mimeMap[ext] || "image/jpeg";
};

// ── MAIN CONTROLLER ───────────────────────────────────────────────────────────
export const analyzeReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: "Koi file upload nahi hui" });
    }

    const filePath = req.file.path;
    const mimeType = getMimeType(req.file.originalname);
    const base64   = fileToBase64(filePath);

    // ── Cleanup uploaded file after reading ──
    fs.unlink(filePath, () => {});

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
You are a medical report analyzer for Appointy healthcare platform.

Analyze this medical report/document carefully and provide:

1. **Report Type**: What kind of report is this? (Blood test, X-Ray, MRI, ECG, Urine test, etc.)

2. **Key Findings**: List the most important findings in simple language (not medical jargon). Mention if any values are abnormal/high/low.

3. **Possible Conditions**: Based on these findings, what conditions might this indicate? (Be careful — say "may suggest" not "you have")

4. **Recommended Specialist**: From ONLY these options, which doctor should the patient see:
   - General physician
   - Gynecologist
   - Dermatologist
   - Pediatricians
   - Neurologist
   - Gastroenterologist

5. **Urgency Level**: Is this URGENT (see doctor today), MODERATE (see doctor this week), or ROUTINE (can wait for regular appointment)?

6. **Simple Advice**: 2-3 practical tips the patient can follow right now.

IMPORTANT RULES:
- Reply in the SAME language the patient is likely to use (if report has Hindi text, reply in Hindi; otherwise English)
- Use simple non-medical language
- Always add disclaimer that this is AI analysis and not a medical diagnosis
- Be empathetic and reassuring in tone
- Start your response with the specialist recommendation on the FIRST LINE in this exact format:
  SPECIALIST: [speciality name]
  Then continue with the full analysis.
`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();

    // ── Extract specialist from first line ──
    const lines     = responseText.split("\n");
    const specLine  = lines.find(l => l.startsWith("SPECIALIST:"));
    const specialist = specLine
      ? specLine.replace("SPECIALIST:", "").trim()
      : null;

    // ── Remove the SPECIALIST: line from display text ──
    const displayText = responseText
      .replace(/^SPECIALIST:.*\n?/m, "")
      .trim();

    res.json({
      success:    true,
      analysis:   displayText,
      specialist,
      reportType: req.file.mimetype,
    });

  } catch (error) {
    console.error("analyzeReport error:", error);
    res.json({ success: false, message: error.message });
  }
};
