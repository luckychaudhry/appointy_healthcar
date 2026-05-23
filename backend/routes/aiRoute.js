import express from "express";
import { symptomChecker } from "../controllers/aiController.js";

const router = express.Router();

router.post("/symptom-check", symptomChecker);
router.get("/test", (req, res) => {
  res.send("AI route working");
});

export default router;