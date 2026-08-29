const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true, index: true },
    ticketId: { type: String, required: true, unique: true, index: true }, // TKT-STAR-38AAD2E4

    // opaque signed token embedded in the QR — never raw PII. Verified via
    // utils/qrToken.js (HMAC signature over ticketId+eventId).
    qrToken: { type: String, required: true },

    ticketType: { type: String, default: "General" },
    status: { type: String, enum: ["ACTIVE", "CANCELLED"], default: "ACTIVE" },

    // whether they're currently inside or outside — used as the atomic
    // gate for check-in/check-out (a conditional update on this field is
    // what makes re-entry safe against two simultaneous scans), separate
    // from the full Attendance log which keeps every IN/OUT event
    currentCheckStatus: { type: String, enum: ["IN", "OUT", null], default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);