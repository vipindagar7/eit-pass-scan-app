const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getOverview } = require("../controllers/analyticsController");

const router = express.Router();
router.get("/overview", requireAuth, requireRole("SUPER_ADMIN"), getOverview);

module.exports = router;
