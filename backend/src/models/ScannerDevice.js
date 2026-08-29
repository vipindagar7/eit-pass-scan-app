const mongoose = require("mongoose");

const scannerDeviceSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    gateId: { type: mongoose.Schema.Types.ObjectId, ref: "Gate", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceName: { type: String, default: "" },
    status: { type: String, enum: ["ACTIVE", "REVOKED"], default: "ACTIVE" },
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ScannerDevice", scannerDeviceSchema);
