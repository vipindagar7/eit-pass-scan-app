const mongoose = require("mongoose");

const emailTemplateSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" }, // null = global default
    type: { type: String, required: true }, // "REGISTRATION_CONFIRMATION", "EVENT_REMINDER", etc.
    subject: { type: String, required: true },
    html: { type: String, required: true }, // supports {{name}}, {{eventName}}, {{ticketId}}, etc.
  },
  { timestamps: true }
);

emailTemplateSchema.index({ eventId: 1, type: 1 });

module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
