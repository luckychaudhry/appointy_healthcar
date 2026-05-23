// ── frontend/src/pages/HealthReportAnalyzer.jsx ──────────────────────────────
import React, { useState, useRef, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import { toast } from "react-toastify";

// ── Speciality to route map ───────────────────────────────────────────────────
const SPEC_ROUTES = {
  "general physician": "/doctors/General physician",
  "gynecologist":      "/doctors/Gynecologist",
  "dermatologist":     "/doctors/Dermatologist",
  "pediatricians":     "/doctors/Pediatricians",
  "neurologist":       "/doctors/Neurologist",
  "gastroenterologist":"/doctors/Gastroenterologist",
};

// ── Speciality icons ──────────────────────────────────────────────────────────
const SPEC_ICONS = {
  "general physician":  "🩺",
  "gynecologist":       "👩‍⚕️",
  "dermatologist":      "🧴",
  "pediatricians":      "👶",
  "neurologist":        "🧠",
  "gastroenterologist": "🫀",
};

// ── Parse markdown-like text into sections ────────────────────────────────────
const parseAnalysis = (text) => {
  if (!text) return [];
  const sections = [];
  const lines    = text.split("\n");
  let current    = null;

  lines.forEach(line => {
    const heading = line.match(/^\*\*(.+?)\*\*:?(.*)$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1], content: heading[2].trim() ? [heading[2].trim()] : [] };
    } else if (current && line.trim()) {
      const clean = line.replace(/^[-*•]\s*/, "").replace(/\*\*/g, "").trim();
      if (clean) current.content.push(clean);
    } else if (!current && line.trim()) {
      sections.push({ title: "", content: [line.replace(/\*\*/g, "").trim()] });
    }
  });

  if (current) sections.push(current);
  return sections.filter(s => s.content.length > 0 || s.title);
};

// ── Section color map ─────────────────────────────────────────────────────────
const SECTION_STYLES = {
  "report type":            { bg: "#EEF2FF", border: "#818CF8", icon: "📋" },
  "key findings":           { bg: "#F0FDF4", border: "#4ADE80", icon: "🔍" },
  "possible conditions":    { bg: "#FFF7ED", border: "#FB923C", icon: "⚠️" },
  "recommended specialist": { bg: "#EFF6FF", border: "#60A5FA", icon: "👨‍⚕️" },
  "urgency level":          { bg: "#FEF2F2", border: "#F87171", icon: "🚨" },
  "simple advice":          { bg: "#F0FDF4", border: "#34D399", icon: "💡" },
};

const getSectionStyle = (title) => {
  const key = title.toLowerCase();
  for (const [k, v] of Object.entries(SECTION_STYLES)) {
    if (key.includes(k)) return v;
  }
  return { bg: "#F9FAFB", border: "#E5E7EB", icon: "📌" };
};

// ── Urgency badge ─────────────────────────────────────────────────────────────
const UrgencyBadge = ({ text }) => {
  const t = text.toLowerCase();
  if (t.includes("urgent")) return (
    <span style={{ background:"#FEE2E2", color:"#DC2626", padding:"3px 12px",
      borderRadius:20, fontSize:12, fontWeight:700 }}>🚨 URGENT</span>
  );
  if (t.includes("moderate")) return (
    <span style={{ background:"#FEF3C7", color:"#D97706", padding:"3px 12px",
      borderRadius:20, fontSize:12, fontWeight:700 }}>⚡ MODERATE</span>
  );
  return (
    <span style={{ background:"#D1FAE5", color:"#059669", padding:"3px 12px",
      borderRadius:20, fontSize:12, fontWeight:700 }}>✅ ROUTINE</span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const HealthReportAnalyzer = () => {
  const { backendUrl, token }  = useContext(AppContext);
  const navigate               = useNavigate();
  const fileInputRef           = useRef(null);

  const [file,        setFile]        = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [dragOver,    setDragOver]    = useState(false);
  const [progress,    setProgress]    = useState(0);

  // ── File select handler ───────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (!allowed.includes(f.type)) {
      toast.error("Only PDF, JPG, PNG files are allowed");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File should be less than 10MB");
      return;
    }
    setFile(f);
    setResult(null);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview("pdf");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Analyze ───────────────────────────────────────────────────────────────
  const analyze = async () => {
    if (!file) return toast.warn("Please select a file first");

    setLoading(true);
    setProgress(0);

    // Fake progress animation
    const interval = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 8 : p);
    }, 400);

    try {
      const formData = new FormData();
      formData.append("report", file);

      const headers = { "Content-Type": "multipart/form-data" };
      if (token) headers.token = token;

      const { data } = await axios.post(
        `${backendUrl}/api/report/analyze`,
        formData,
        { headers }
      );

      clearInterval(interval);
      setProgress(100);

      if (data.success) {
        setResult(data);
        setTimeout(() => {
          document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
        }, 300);
      } else {
        toast.error(data.message || "Analysis failed");
      }
    } catch (err) {
      clearInterval(interval);
      toast.error("Server error — please try again");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setProgress(0);
  };

  const sections   = parseAnalysis(result?.analysis);
  const specialist = result?.specialist?.toLowerCase();
  const specRoute  = specialist ? SPEC_ROUTES[specialist] : null;
  const specIcon   = specialist ? SPEC_ICONS[specialist] : "🩺";

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      maxWidth: 780,
      margin: "0 auto",
      padding: "32px 16px 64px",
    }}>

      {/* ── Page Header ── */}
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <div style={{
          display:"inline-flex", alignItems:"center", justifyContent:"center",
          width:64, height:64, borderRadius:20, fontSize:28,
          background:"linear-gradient(135deg,#EEF2FF,#E0E7FF)",
          marginBottom:16, boxShadow:"0 4px 20px rgba(99,102,241,0.15)"
        }}>🔬</div>
        <h1 style={{
          fontSize:28, fontWeight:800, color:"#1a1a2e",
          margin:"0 0 8px", letterSpacing:"-0.03em"
        }}>AI Health Report Analyzer</h1>
        <p style={{ fontSize:15, color:"#6B7280", margin:0, maxWidth:480, marginInline:"auto" }}>
         Upload your medical reports and get instant analysis, key findings, and specialist recommendations using our AI-powered health report analyzer.
        </p>
      </div>

      {/* ── Upload Area ── */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? "#6366F1" : file ? "#10B981" : "#C7D2FE"}`,
            borderRadius: 20,
            padding: "40px 24px",
            textAlign: "center",
            cursor: file ? "default" : "pointer",
            background: dragOver ? "#EEF2FF" : file ? "#F0FDF4" : "#FAFBFF",
            transition: "all 0.25s",
            marginBottom: 24,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display:"none" }}
            onChange={e => handleFile(e.target.files[0])}
          />

          {!file ? (
            <>
              <div style={{ fontSize:48, marginBottom:16 }}>📂</div>
              <p style={{ fontSize:16, fontWeight:600, color:"#374151", margin:"0 0 6px" }}>
                Click or drag your health report here
              </p>
              <p style={{ fontSize:13, color:"#9CA3AF", margin:0 }}>
                PDF, JPG, PNG, WEBP — max 10MB
              </p>
              <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:20, flexWrap:"wrap" }}>
                {["🩸 Blood Report","🫁 X-Ray","🧪 Lab Results","💊 Prescription","🔬 MRI Scan"].map(t => (
                  <span key={t} style={{
                    background:"#EEF2FF", color:"#4338CA", fontSize:12,
                    padding:"4px 12px", borderRadius:20, fontWeight:500
                  }}>{t}</span>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:16, justifyContent:"center" }}>
              {preview === "pdf" ? (
                <div style={{
                  width:56, height:72, background:"#FEE2E2", borderRadius:8,
                  display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", fontSize:10, color:"#DC2626", fontWeight:700
                }}>
                  <div style={{ fontSize:24 }}>📄</div>
                  PDF
                </div>
              ) : (
                <img src={preview} alt="preview" style={{
                  width:72, height:72, objectFit:"cover", borderRadius:10,
                  border:"2px solid #10B981"
                }}/>
              )}
              <div style={{ textAlign:"left" }}>
                <p style={{ fontWeight:600, color:"#1a1a2e", margin:"0 0 4px", fontSize:15 }}>
                  {file.name}
                </p>
                <p style={{ color:"#6B7280", margin:"0 0 8px", fontSize:13 }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button onClick={(e) => { e.stopPropagation(); reset(); }} style={{
                  background:"#FEE2E2", color:"#DC2626", border:"none",
                  padding:"4px 12px", borderRadius:8, fontSize:12,
                  cursor:"pointer", fontWeight:500
                }}>Remove</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {loading && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:13, color:"#6B7280", fontWeight:500 }}>
              AI report analyze kar raha hai...
            </span>
            <span style={{ fontSize:13, color:"#6366F1", fontWeight:700 }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{ height:6, background:"#E0E7FF", borderRadius:99, overflow:"hidden" }}>
            <div style={{
              height:"100%",
              width:`${progress}%`,
              background:"linear-gradient(90deg,#6366F1,#8B5CF6)",
              borderRadius:99,
              transition:"width 0.4s ease"
            }}/>
          </div>
          <p style={{ fontSize:12, color:"#9CA3AF", marginTop:8, textAlign:"center" }}>
            {progress < 30 ? "File reading" :
             progress < 60 ? "Medical data is being analyzed" :
             progress < 85 ? "Doctor is suggesting..." :
             "Almost done..."}
          </p>
        </div>
      )}

      {/* ── Analyze Button ── */}
      {!result && (
        <button
          onClick={analyze}
          disabled={!file || loading}
          style={{
            width:"100%", padding:"16px",
            background: file && !loading
              ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
              : "#E5E7EB",
            color: file && !loading ? "#fff" : "#9CA3AF",
            border:"none", borderRadius:14, fontSize:16, fontWeight:700,
            cursor: file && !loading ? "pointer" : "not-allowed",
            transition:"all 0.2s",
            boxShadow: file && !loading ? "0 4px 20px rgba(99,102,241,0.35)" : "none",
            marginBottom:32,
          }}
        >
          {loading ? "⏳ Analyzing..." : "🔬 Report Analyze "}
        </button>
      )}

      {/* ── RESULT SECTION ── */}
      {result && (
        <div id="result-section">

          {/* ── Doctor recommendation card — most prominent ── */}
          {specialist && (
            <div style={{
              background:"linear-gradient(135deg,#6366F1,#8B5CF6)",
              borderRadius:20, padding:"28px 28px",
              marginBottom:24, color:"#fff",
              boxShadow:"0 8px 32px rgba(99,102,241,0.3)"
            }}>
              <p style={{ fontSize:12, opacity:0.8, margin:"0 0 6px", letterSpacing:"0.1em", textTransform:"uppercase" }}>
                Recommended Specialist
              </p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{
                    width:56, height:56, borderRadius:16, fontSize:26,
                    background:"rgba(255,255,255,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center"
                  }}>{specIcon}</div>
                  <div>
                    <p style={{ fontSize:22, fontWeight:800, margin:0, textTransform:"capitalize" }}>
                      {result.specialist}
                    </p>
                    <p style={{ fontSize:13, opacity:0.8, margin:"3px 0 0" }}>
                      Book an appointment with our top {result.specialist} to discuss your report in detail and get personalized advice.
                    </p>
                  </div>
                </div>
                {specRoute && (
                  <button
                    onClick={() => navigate(specRoute)}
                    style={{
                      background:"#fff", color:"#6366F1",
                      border:"none", borderRadius:12, padding:"12px 24px",
                      fontSize:14, fontWeight:700, cursor:"pointer",
                      boxShadow:"0 4px 12px rgba(0,0,0,0.15)",
                      whiteSpace:"nowrap"
                    }}
                  >
                    Find doctor →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Analysis sections ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
            {sections.map((sec, i) => {
              const style = getSectionStyle(sec.title);
              const isUrgency = sec.title.toLowerCase().includes("urgency");

              return (
                <div key={i} style={{
                  background: style.bg,
                  borderLeft:`4px solid ${style.border}`,
                  borderRadius:14, padding:"18px 20px",
                  animation:`fadeUp 0.4s ease ${i * 0.08}s both`,
                }}>
                  {sec.title && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                      <span style={{ fontSize:16 }}>{style.icon}</span>
                      <p style={{ fontSize:13, fontWeight:700, color:"#374151",
                        margin:0, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                        {sec.title}
                      </p>
                    </div>
                  )}
                  {sec.content.map((line, j) => (
                    <div key={j} style={{ display:"flex", gap:10, marginBottom:j < sec.content.length-1 ? 6 : 0 }}>
                      {sec.content.length > 1 && (
                        <span style={{ color:style.border, marginTop:2, flexShrink:0 }}>•</span>
                      )}
                      <p style={{ fontSize:14, color:"#374151", margin:0, lineHeight:1.6 }}>
                        {isUrgency ? <UrgencyBadge text={line}/> : line}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* ── Disclaimer ── */}
          <div style={{
            background:"#FFFBEB", border:"1px solid #FDE68A",
            borderRadius:12, padding:"14px 18px", marginBottom:24
          }}>
            <p style={{ fontSize:12, color:"#92400E", margin:0, lineHeight:1.7 }}>
              ⚠️ <strong>Disclaimer:</strong> This AI analysis is for informational purposes only and should not be considered a medical diagnosis. Always consult with a qualified healthcare professional for medical advice and treatment.
            </p>
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {specRoute && (
              <button
                onClick={() => navigate(specRoute)}
                style={{
                  flex:1, minWidth:180, padding:"14px",
                  background:"linear-gradient(135deg,#6366F1,#8B5CF6)",
                  color:"#fff", border:"none", borderRadius:12,
                  fontSize:14, fontWeight:700, cursor:"pointer",
                  boxShadow:"0 4px 16px rgba(99,102,241,0.3)"
                }}
              >
                🗓 Book Appointment
              </button>
            )}
            <button
              onClick={reset}
              style={{
                flex:1, minWidth:180, padding:"14px",
                background:"#F9FAFB", color:"#374151",
                border:"1.5px solid #E5E7EB", borderRadius:12,
                fontSize:14, fontWeight:600, cursor:"pointer"
              }}
            >
              🔄 Analyze a New Report
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default HealthReportAnalyzer;
