const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated", code: "NO_TOKEN" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Always look the user up fresh rather than trusting assignedEvents
    // baked into the token at login time — otherwise a user assigned to
    // a new event after they last logged in wouldn't see it until they
    // logged out and back in (and the reverse: role/assignment changes
    // wouldn't take effect either).
    const user = await User.findById(payload.id);
    if (!user || user.disabled) {
      return res.status(401).json({ success: false, message: "Account no longer active", code: "ACCOUNT_INACTIVE" });
    }

    req.user = {
      id: String(user._id),
      role: user.role,
      assignedEvents: (user.assignedEvents || []).map(String),
      name: user.name,
      email: user.email,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session", code: "INVALID_TOKEN" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    // Super Admin has every role's capabilities by design — this is
    // enforced here structurally so it can never be accidentally left out
    // of a future route's allowed-roles list.
    if (req.user.role === "SUPER_ADMIN") return next();

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Not authorized for this action", code: "FORBIDDEN" });
    }
    next();
  };
}

// Verifies the user has access to the :eventId in the route params —
// SUPER_ADMIN always passes; other roles must have it in assignedEvents.
// Never trust eventId/role from the client without this check.
function requireEventAccess(req, res, next) {
  const eventId = req.params.eventId || req.params.id;
  if (req.user.role === "SUPER_ADMIN") return next();

  const assigned = (req.user.assignedEvents || []).map(String);
  if (!eventId || !assigned.includes(String(eventId))) {
    return res.status(403).json({ success: false, message: "No access to this event", code: "EVENT_FORBIDDEN" });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireEventAccess };