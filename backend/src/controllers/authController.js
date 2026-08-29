const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.disabled) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      assignedEvents: user.assignedEvents,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ success: true, data: { token, user: user.toSafeJSON() } });
}

async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, data: user.toSafeJSON() });
}

module.exports = { login, me };
