const mongoose = require("mongoose");

const gateSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true }, // "Gate 1", "VIP Gate"
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

gateSchema.index({ eventId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Gate", gateSchema);
