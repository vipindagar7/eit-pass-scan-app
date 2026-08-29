const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const { queueEmail } = require("../services/emailService");

const CREDENTIALS_TEMPLATE = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Hi {{name}},</h2>
    <p>An account has been created for you on the Event Platform.</p>
    <p>
      Login: <strong>{{email}}</strong><br/>
      Password: <strong>{{password}}</strong>
    </p>
    <p><a href="{{loginUrl}}">{{loginUrl}}</a></p>
    <p style="color:#888; font-size:13px;">Please keep this password safe.</p>
  </div>
`;

function sendCredentialsEmail({ name, email, password }) {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  return queueEmail({
    to: email,
    subject: "Your Event Platform account",
    html: CREDENTIALS_TEMPLATE,
    type: "ACCOUNT_CREDENTIALS",
    vars: { name, email, password, loginUrl },
  }).catch((err) => console.error("[email] credentials send failed:", err.message));
}

async function listUsers(req, res) {
  const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
  res.json({ success: true, data: users });
}

async function createUser(req, res) {
  const { name, email, password, role, assignedEvents, assignedGates } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Name, email, password, and role are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return res.status(409).json({ success: false, message: "That email is already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    assignedEvents: assignedEvents || [],
    assignedGates: assignedGates || [],
  });

  // best-effort — the account is created either way, this just fails
  // quietly if SMTP isn't configured
  sendCredentialsEmail({ name, email: user.email, password });

  res.json({ success: true, data: user.toSafeJSON() });
}

async function updateUser(req, res) {
  const { name, role, assignedEvents, assignedGates, disabled } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = name;
  if (role !== undefined) update.role = role;
  if (assignedEvents !== undefined) update.assignedEvents = assignedEvents;
  if (assignedGates !== undefined) update.assignedGates = assignedGates;
  if (disabled !== undefined) update.disabled = disabled;

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: user });
}

async function resetPassword(req, res) {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ success: false, message: "New password is required" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findByIdAndUpdate(req.params.id, { passwordHash }, { new: true }).select("-passwordHash");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  sendCredentialsEmail({ name: user.name, email: user.email, password });

  res.json({ success: true, data: user });
}

async function deleteUser(req, res) {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}

// POST /api/users/:id/send-credentials — one-click "email them their
// login details" action. We only ever store a password HASH, never the
// original plaintext, so there's no original password to resend — this
// generates a fresh one, saves it, and emails it. Functionally the same
// as reset-password, just without the admin having to type a new one.
async function sendCredentials(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const newPassword = crypto.randomBytes(9).toString("base64url"); // ~12 char random password
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  const notification = await sendCredentialsEmail({ name: user.name, email: user.email, password: newPassword });

  res.json({ success: true, data: { emailed: notification?.status === "SENT" } });
}

module.exports = { listUsers, createUser, updateUser, resetPassword, deleteUser, sendCredentials };