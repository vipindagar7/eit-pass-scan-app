const express = require("express");
const { requireAuth, requireRole, requireEventAccess } = require("../middleware/auth");
const {
  listGates,
  createGate,
  updateGate,
  deleteGate,
  listScanners,
  createScanner,
  revokeScanner,
} = require("../controllers/gateController");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireEventAccess);

router.get("/gates", listGates);
router.post("/gates", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), createGate);
router.patch("/gates/:gateId", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), updateGate);
router.delete("/gates/:gateId", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), deleteGate);

router.get("/scanners", requireRole("SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER"), listScanners);
router.post("/scanners", requireRole("SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER"), createScanner);
router.post("/scanners/:scannerId/revoke", requireRole("SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER"), revokeScanner);

module.exports = router;
