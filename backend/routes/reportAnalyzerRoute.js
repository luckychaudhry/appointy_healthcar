// ── backend/routes/reportAnalyzerRoute.js ────────────────────────────────────
import express from "express";
import { analyzeReport } from "../controllers/reportAnalyzerController.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// ── Multer config — PDF + images allow karo ──────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename:    (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Sirf PDF, JPG, PNG, WEBP files allowed hain"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /api/report/analyze
router.post("/analyze", upload.single("report"), analyzeReport);

export default router;
