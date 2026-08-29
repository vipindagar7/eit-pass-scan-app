const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, default: "GENERIC" }, // e.g. "REGISTRATION_CONFIRMATION"
    status: { type: String, enum: ["PENDING", "SENT", "FAILED", "RETRYING"], default: "PENDING" },
    sentAt: { type: Date },
    failReason: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
