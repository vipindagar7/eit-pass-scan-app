const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    registrationId: { type: String, required: true, unique: true, index: true }, // REG-2026-000123

    // flexible per-event fields, e.g. { teamName, githubUrl, college }
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

    // snapshot of the form field definitions at submission time, so old
    // registrations stay readable even if the event's form changes later
    formSnapshot: [{ type: mongoose.Schema.Types.Mixed }],

    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED", "PENDING"],
      default: "CONFIRMED",
    },

    // the value used for this event's configured uniqueField, indexed for
    // fast duplicate checks and search
    uniqueValue: { type: String, index: true },
  },
  { timestamps: true }
);

registrationSchema.index({ eventId: 1, uniqueValue: 1 });

module.exports = mongoose.model("Registration", registrationSchema);
