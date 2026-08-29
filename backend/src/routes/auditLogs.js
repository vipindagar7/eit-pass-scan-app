const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const AuditLog = require("../models/AuditLog");

const router = express.Router();
router.use(requireAuth, requireRole("SUPER_ADMIN"));

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({ success: true, data: logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

module.exports = router;
