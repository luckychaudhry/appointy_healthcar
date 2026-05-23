import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import appointmentModel from "../models/appointmentModel.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

// Appointy stores slotDate as "5_4_2026" — convert to "05 Apr 2026"
const MONTHS = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const formatSlotDate = (slotDate) => {
  if (!slotDate) return "N/A";
  const [d, m, y] = slotDate.split("_");
  return `${String(d).padStart(2,"0")} ${MONTHS[Number(m)] || m} ${y}`;
};

// PDFKit does not support ₹ in built-in fonts — use "Rs." instead
// (avoids blank/box character in the PDF)
const rs = (amount) => `Rs. ${Number(amount).toFixed(2)}`;

// Draw a horizontal rule
const hr = (doc, y, color = "#E5E7EB") => {
  doc.strokeColor(color).lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke();
};

// Draw a filled rectangle row (for table rows)
const filledRow = (doc, y, h, color) => {
  doc.rect(50, y, 495, h).fill(color);
};

// ─── main controller ─────────────────────────────────────────────────────────
export const downloadInvoice = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appt = await appointmentModel.findById(appointmentId);

    if (!appt) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    if (!appt.payment) {
      return res.status(403).json({ success: false, message: "Payment not completed yet" });
    }

    // ── ensure invoices folder exists ─────────────────────────────────────
    const invoicesDir = path.resolve("invoices");
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });
    const filePath = path.join(invoicesDir, `invoice-${appointmentId}.pdf`);

    // ── colors ────────────────────────────────────────────────────────────
    const PRIMARY   = "#5F6FFF";   // Appointy brand color
    const DARK      = "#1F2937";
    const MUTED     = "#6B7280";
    const LIGHT_BG  = "#F3F4F6";
    const GREEN     = "#10B981";
    const WHITE     = "#FFFFFF";
    const BORDER    = "#E5E7EB";

    // ── amounts ───────────────────────────────────────────────────────────
    const baseAmount  = Number(appt.amount) || 0;
    const cgst        = parseFloat((baseAmount * 0.09).toFixed(2));
    const sgst        = parseFloat((baseAmount * 0.09).toFixed(2));
    const totalAmount = parseFloat((baseAmount + cgst + sgst).toFixed(2));

    // ── invoice meta ──────────────────────────────────────────────────────
    const invoiceNo   = `INV-${appt._id.toString().slice(-8).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric"
    });
    const apptDate    = formatSlotDate(appt.slotDate);
    const apptTime    = appt.slotTime || "N/A";

    // ── patient & doctor ──────────────────────────────────────────────────
    const patient   = appt.userData  || {};
    const doctor    = appt.docData   || {};
    const address   = doctor.address
      ? [doctor.address.line1, doctor.address.line2].filter(Boolean).join(", ")
      : "N/A";

    // ── Razorpay payment ID ───────────────────────────────────────────────
    // verifyRazorpay currently stores payment:true (boolean).
    // If you later store the full response object, this will auto-display the ID.
    // razorpay_payment_id is now saved as a dedicated field in appointmentModel
    const paymentId = appt.razorpay_payment_id || "N/A";

    // ── build PDF ─────────────────────────────────────────────────────────
    const doc    = new PDFDocument({ margin: 0, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89

    // ══════════════════════════════════════════════════════════════════════
    // 1. TOP COLOR BAR
    // ══════════════════════════════════════════════════════════════════════
    doc.rect(0, 0, W, 10).fill(PRIMARY);

    // ══════════════════════════════════════════════════════════════════════
    // 2. HEADER — logo left, contact right
    // ══════════════════════════════════════════════════════════════════════
    const hTop = 28;

    // Brand name
    doc.fontSize(24).fillColor(PRIMARY).font("Helvetica-Bold")
       .text("APPOINTY", 50, hTop);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
       .text("HEALTHCARE", 50, hTop + 28)
       .text("Your Health, Our Priority", 50, hTop + 40);

    // Contact block (right)
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
       .text("www.appointy.in",            0, hTop,      { width: W - 50, align: "right" })
       .text("customersupport@appointy.in", 0, hTop + 13, { width: W - 50, align: "right" })
       .text("+91-90000-90000",             0, hTop + 26, { width: W - 50, align: "right" });

    hr(doc, 90);

    // ══════════════════════════════════════════════════════════════════════
    // 3. INVOICE TITLE + META
    // ══════════════════════════════════════════════════════════════════════
    doc.fontSize(30).fillColor(DARK).font("Helvetica-Bold")
       .text("INVOICE", 50, 104);

    // Invoice number & date (right column)
    const metaLabelX = 360;
    const metaValueX = 460;

    const metaRows = [
      { label: "Invoice No.",   value: invoiceNo   },
      { label: "Invoice Date",  value: invoiceDate },
      { label: "Appt. Date",    value: apptDate    },
      { label: "Appt. Time",    value: apptTime    },
    ];
    metaRows.forEach((row, i) => {
      const y = 108 + i * 16;
      doc.fontSize(9).fillColor(MUTED).font("Helvetica")
         .text(row.label, metaLabelX, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold")
         .text(row.value, metaValueX, y, { width: 90, align: "right" });
    });

    hr(doc, 175);

    // ══════════════════════════════════════════════════════════════════════
    // 4. BILLED TO  +  PAYMENT STATUS BADGE
    // ══════════════════════════════════════════════════════════════════════
    const billY = 188;

    doc.fontSize(9).fillColor(PRIMARY).font("Helvetica-Bold")
       .text("BILLED TO", 50, billY);

    doc.fontSize(12).fillColor(DARK).font("Helvetica-Bold")
       .text(patient.name  || "N/A", 50, billY + 14);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
       .text(patient.email || "N/A", 50, billY + 29)
       .text(patient.phone || "N/A", 50, billY + 42);

    // Status badge
    const badgeW = 160, badgeH = 28, badgeX = W - 50 - badgeW;
    doc.roundedRect(badgeX, billY, badgeW, badgeH, 14).fill(GREEN);
    doc.fontSize(10).fillColor(WHITE).font("Helvetica-Bold")
       .text("PAYMENT COMPLETED", badgeX, billY + 8, { width: badgeW, align: "center" });

    hr(doc, billY + 68);

    // ══════════════════════════════════════════════════════════════════════
    // 5. TWO-COLUMN: APPOINTMENT DETAILS  |  DOCTOR DETAILS
    // ══════════════════════════════════════════════════════════════════════
    const secY = billY + 80;
    const col2X = 310;

    // Section headings
    doc.fontSize(9).fillColor(PRIMARY).font("Helvetica-Bold")
       .text("APPOINTMENT DETAILS", 50, secY)
       .text("DOCTOR DETAILS",      col2X, secY);

    const apptDetails = [
      { label: "Date",        value: apptDate },
      { label: "Time",        value: apptTime },
      { label: "Status",      value: appt.isCompleted ? "Completed" : "Booked" },
    ];
    const docDetails = [
      { label: "Name",        value: `Dr. ${doctor.name      || "N/A"}` },
      { label: "Speciality",  value: doctor.speciality        || "N/A"  },
      { label: "Degree",      value: doctor.degree            || "N/A"  },
      { label: "Address",     value: address                            },
    ];

    const detLH = 18;
    apptDetails.forEach((r, i) => {
      const y = secY + 14 + i * detLH;
      doc.fontSize(9).fillColor(MUTED).font("Helvetica").text(r.label + ":", 50, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold").text(r.value, 130, y);
    });
    docDetails.forEach((r, i) => {
      const y = secY + 14 + i * detLH;
      doc.fontSize(9).fillColor(MUTED).font("Helvetica").text(r.label + ":", col2X, y);
      doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold")
         .text(r.value, col2X + 70, y, { width: 180 });
    });

    hr(doc, secY + 110);

    // ══════════════════════════════════════════════════════════════════════
    // 6. PAYMENT BREAKDOWN TABLE
    // ══════════════════════════════════════════════════════════════════════
    const tblY = secY + 122;

    // Table header
    filledRow(doc, tblY, 24, PRIMARY);
    doc.fontSize(9).fillColor(WHITE).font("Helvetica-Bold")
       .text("DESCRIPTION",   60,        tblY + 7)
       .text("AMOUNT",        0,          tblY + 7, { width: W - 55, align: "right" });

    // Table rows
    const tableRows = [
      { desc: "Consultation Fee",                       amt: rs(baseAmount) },
      { desc: `CGST @ 9%  (on Rs. ${baseAmount})`,     amt: rs(cgst)       },
      { desc: `SGST @ 9%  (on Rs. ${baseAmount})`,     amt: rs(sgst)       },
    ];

    tableRows.forEach((row, i) => {
      const rowY   = tblY + 24 + i * 26;
      const rowBg  = i % 2 === 0 ? WHITE : LIGHT_BG;
      filledRow(doc, rowY, 26, rowBg);
      doc.fontSize(10).fillColor(DARK).font("Helvetica")
         .text(row.desc, 60, rowY + 8)
         .text(row.amt,   0, rowY + 8, { width: W - 55, align: "right" });
    });

    // Total row
    const totalRowY = tblY + 24 + tableRows.length * 26;
    filledRow(doc, totalRowY, 32, DARK);
    doc.fontSize(11).fillColor(WHITE).font("Helvetica-Bold")
       .text("TOTAL AMOUNT PAID",  60, totalRowY + 9)
       .text(rs(totalAmount),       0, totalRowY + 9, { width: W - 55, align: "right" });

    // ══════════════════════════════════════════════════════════════════════
    // 7. PAYMENT METHOD BOX
    // ══════════════════════════════════════════════════════════════════════
    const pmY = totalRowY + 50;

    doc.roundedRect(50, pmY, 495, 54, 6)
       .strokeColor(BORDER).lineWidth(0.5).stroke();

    doc.fontSize(9).fillColor(PRIMARY).font("Helvetica-Bold")
       .text("PAYMENT INFORMATION", 65, pmY + 10);

    doc.fontSize(9).fillColor(MUTED).font("Helvetica")
       .text("Method:",         65,  pmY + 25)
       .text("Transaction ID:", 265, pmY + 25);

    doc.fontSize(9).fillColor(DARK).font("Helvetica-Bold")
       .text("Razorpay (Online)",  130, pmY + 25)
       .text(paymentId,            360, pmY + 25, { width: 175 });

    // ══════════════════════════════════════════════════════════════════════
    // 8. THANK YOU NOTE
    // ══════════════════════════════════════════════════════════════════════
    const tyY = pmY + 80;
    filledRow(doc, tyY, 36, "#EEF2FF");
    doc.fontSize(11).fillColor(PRIMARY).font("Helvetica-Bold")
       .text("Thank you for choosing Appointy Healthcare!", 0, tyY + 11, {
         width: W, align: "center"
       });

    // ══════════════════════════════════════════════════════════════════════
    // 9. FOOTER
    // ══════════════════════════════════════════════════════════════════════
    hr(doc, H - 50);
    doc.fontSize(8).fillColor(MUTED).font("Helvetica")
       .text(
         "This is a computer-generated invoice and does not require a physical signature.",
         50, H - 42, { width: 345 }
       );
    doc.fontSize(8).fillColor(MUTED)
       .text("Page 1 of 1", 0, H - 42, { width: W - 50, align: "right" });

    // Bottom bar
    doc.rect(0, H - 10, W, 10).fill(PRIMARY);

    // ── end & stream ──────────────────────────────────────────────────────
    doc.end();

    stream.on("finish", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Appointy-Invoice-${invoiceNo}.pdf"`
      );
      res.download(filePath, `Appointy-Invoice-${invoiceNo}.pdf`, (err) => {
        if (err) console.error("Download error:", err.message);
        // Clean up file after sending (optional — comment out to cache invoices)
        // fs.unlink(filePath, () => {});
      });
    });

    stream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).json({ success: false, message: "PDF generation failed" });
    });

  } catch (error) {
    console.error("Invoice error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default downloadInvoice;
