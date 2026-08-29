const express = require("express");
const { requireAuth, requireRole, requireEventAccess } = require("../middleware/auth");
const {
  listDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  triggerImport,
  toggleLiveSync,
  previewDataSource,
} = require("../controllers/dataSourceController");
const { createManualRegistration, createBulkRegistrations } = require("../controllers/adminRegistrationController");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireEventAccess, requireRole("SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER"));

router.get("/data-sources", listDataSources);
router.post("/data-sources/preview", previewDataSource);
router.post("/data-sources", createDataSource);
router.patch("/data-sources/:dataSourceId", updateDataSource);
router.delete("/data-sources/:dataSourceId", deleteDataSource);
router.post("/data-sources/:dataSourceId/import", triggerImport);
router.post("/data-sources/:dataSourceId/live-sync", toggleLiveSync);

router.post("/registrations/manual", createManualRegistration);
router.post("/registrations/bulk", createBulkRegistrations);

module.exports = router;