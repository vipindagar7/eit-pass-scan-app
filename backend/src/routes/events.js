const express = require("express");
const { requireAuth, requireRole, requireEventAccess } = require("../middleware/auth");
const {
  listEvents,
  getEvent,
  getEventBySlug,
  createEvent,
  updateEvent,
  updateEventStatus,
  duplicateEvent,
  deleteEvent,
} = require("../controllers/eventController");
const { getForm, saveForm } = require("../controllers/eventFormController");
const { submitRegistration, listRegistrations, updateRegistration, deleteRegistration } = require("../controllers/registrationController");

const router = express.Router();

// public
router.get("/public/:slug", getEventBySlug);
router.post("/:eventId/register", submitRegistration);
router.get("/:eventId/form", getForm); // public — needed to render the registration form

// authenticated
router.use(requireAuth);

router.get("/", listEvents);
router.post("/", requireRole("SUPER_ADMIN"), createEvent);
router.get("/:id", requireEventAccess, getEvent);
router.patch("/:id", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), requireEventAccess, updateEvent);
router.patch("/:id/status", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), requireEventAccess, updateEventStatus);
router.post("/:id/duplicate", requireRole("SUPER_ADMIN"), duplicateEvent);
router.delete("/:id", requireRole("SUPER_ADMIN"), deleteEvent);

router.put("/:eventId/form", requireRole("SUPER_ADMIN", "EVENT_ADMIN"), requireEventAccess, saveForm);

router.get(
  "/:eventId/registrations",
  requireRole("SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER"),
  requireEventAccess,
  listRegistrations
);
router.patch(
  "/:eventId/registrations/:recordId",
  requireRole("SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER"),
  requireEventAccess,
  updateRegistration
);
router.delete(
  "/:eventId/registrations/:recordId",
  requireRole("SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER"),
  requireEventAccess,
  deleteRegistration
);

module.exports = router;