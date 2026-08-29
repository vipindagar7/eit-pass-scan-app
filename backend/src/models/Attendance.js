const mongoose = require("mongoose");

// Each check-in or check-out is its own log entry — a ticket can have
// many of these over the course of an event (in, out, back in again,
// etc). "Currently checked in or not" is derived from the most recent
// entry, not stored redundantly here.
const attendanceSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    scannerId: { type: mongoose.Schema.Types.ObjectId, ref: "ScannerDevice" },
    gateId: { type: mongoose.Schema.Types.ObjectId, ref: "Gate" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
    method: { type: String, enum: ["QR", "MANUAL", "ADMIN"], default: "QR" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

attendanceSchema.index({ ticketId: 1, at: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);