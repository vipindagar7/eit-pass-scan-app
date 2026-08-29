const mongoose = require("mongoose");

const EVENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
];

const eventSchema = new mongoose.Schema(
  {
    eventCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: "" },
    banner: { type: String, default: "" },
    logo: { type: String, default: "" },
    venue: { type: String, default: "" },
    startDate: { type: Date },
    endDate: { type: Date },
    registrationStart: { type: Date },
    registrationEnd: { type: Date },
    checkInStart: { type: Date },
    checkInEnd: { type: Date },
    status: { type: String, enum: EVENT_STATUSES, default: "DRAFT" },
    theme: { type: mongoose.Schema.Types.Mixed, default: {} },
    // which submitted field's value must be unique per registration for
    // THIS event — not hardcoded to email/phone (per-event configurable)
    uniqueField: { type: String, default: "email" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
module.exports.EVENT_STATUSES = EVENT_STATUSES;
