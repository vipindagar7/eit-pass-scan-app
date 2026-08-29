const express = require("express");
const { requireAuth, requireRole, requireEventAccess } = require("../middleware/auth");
const { scanResolve, scanMark, listAttendance } = require("../controllers/scannerController");
const { getEventAnalytics } = require("../controllers/analyticsController");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireEventAccess);

const scanRoles = ["SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER", "SCANNER"];
router.post("/scan/resolve", requireRole(...scanRoles), scanResolve);
router.post("/scan/mark", requireRole(...scanRoles), scanMark);
router.get(
  "/attendance",
  requireRole("SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER", "REGISTRATION_MANAGER"),
  listAttendance
);
router.get("/analytics", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), getEventAnalytics);

module.exports = router;