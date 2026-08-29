const mongoose = require("mongoose");

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "RADIO",
  "CHECKBOX",
  "URL",
  "FILE",
];

const fieldSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true }, // stable id, e.g. nanoid
    label: { type: String, required: true },
    name: { type: String, required: true }, // key used in customFields
    type: { type: String, enum: FIELD_TYPES, required: true },
    placeholder: { type: String, default: "" },
    required: { type: Boolean, default: false },
    options: [{ type: String }], // for SELECT/MULTI_SELECT/RADIO/CHECKBOX
    validation: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { min, max, pattern }
    order: { type: Number, default: 0 },
    helpText: { type: String, default: "" },
    visible: { type: Boolean, default: true },
  },
  { _id: false }
);

const eventFormSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, unique: true, index: true },
    fields: [fieldSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventForm", eventFormSchema);
module.exports.FIELD_TYPES = FIELD_TYPES;
