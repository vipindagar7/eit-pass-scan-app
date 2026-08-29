const mongoose = require("mongoose");

const ROLES = ["SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER", "GATE_MANAGER", "SCANNER"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true },
    // event-scoped roles (EVENT_ADMIN, REGISTRATION_MANAGER, GATE_MANAGER,
    // SCANNER) are limited to these events; SUPER_ADMIN ignores this field
    assignedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    // for GATE_MANAGER/SCANNER — which gate(s) they're scoped to, if any
    assignedGates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Gate" }],
    disabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
