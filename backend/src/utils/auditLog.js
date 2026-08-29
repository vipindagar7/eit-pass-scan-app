const AuditLog = require("../models/AuditLog");

// Fire-and-forget style — an audit-log write failing should never break
// the actual admin action it's logging.
async function logAction(req, action, entity, entityId, metadata = {}) {
  try {
    await AuditLog.create({
      userId: req.user?.id,
      action,
      entity,
      entityId,
      metadata,
      ip: req.ip,
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err.message);
  }
}

module.exports = { logAction };
