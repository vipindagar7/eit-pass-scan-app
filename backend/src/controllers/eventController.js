const Event = require("../models/Event");

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function listEvents(req, res) {
  // SUPER_ADMIN sees all events; event-scoped roles see only assigned ones
  if (req.user.role !== "SUPER_ADMIN") {
    const assigned = req.user.assignedEvents || [];
    if (assigned.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const events = await Event.find({ _id: { $in: assigned } }).sort({ createdAt: -1 });
    return res.json({ success: true, data: events });
  }

  const events = await Event.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: events });
}

async function getEvent(req, res) {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });
  res.json({ success: true, data: event });
}

async function getEventBySlug(req, res) {
  // public — for the /events/:slug page
  const event = await Event.findOne({ slug: req.params.slug });
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });
  res.json({ success: true, data: event });
}

async function createEvent(req, res) {
  const { eventCode, name, description, venue, startDate, endDate, registrationStart, registrationEnd, checkInStart, checkInEnd, uniqueField } = req.body || {};

  if (!eventCode || !name) {
    return res.status(400).json({ success: false, message: "eventCode and name are required" });
  }

  let slug = slugify(name);
  const slugExists = await Event.findOne({ slug });
  if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

  const event = await Event.create({
    eventCode: eventCode.toUpperCase().trim(),
    name,
    slug,
    description,
    venue,
    startDate,
    endDate,
    registrationStart,
    registrationEnd,
    checkInStart,
    checkInEnd,
    uniqueField: uniqueField || "email",
    createdBy: req.user.id,
  });

  res.json({ success: true, data: event });
}

async function updateEvent(req, res) {
  const update = { ...req.body };
  delete update.eventCode; // immutable once created, to avoid breaking ticket IDs
  delete update.slug;
  delete update.createdBy;

  const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });
  res.json({ success: true, data: event });
}

async function updateEventStatus(req, res) {
  const { status } = req.body || {};
  const event = await Event.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });
  res.json({ success: true, data: event });
}

async function duplicateEvent(req, res) {
  const original = await Event.findById(req.params.id);
  if (!original) return res.status(404).json({ success: false, message: "Event not found" });

  const obj = original.toObject();
  delete obj._id;
  delete obj.createdAt;
  delete obj.updatedAt;
  obj.name = `${obj.name} (Copy)`;
  obj.eventCode = `${obj.eventCode}-COPY-${Date.now().toString(36).toUpperCase()}`;
  obj.slug = `${obj.slug}-copy-${Date.now().toString(36)}`;
  obj.status = "DRAFT";
  obj.createdBy = req.user.id;

  const copy = await Event.create(obj);
  res.json({ success: true, data: copy });
}

async function deleteEvent(req, res) {
  const Registration = require("../models/Registration");
  const count = await Registration.countDocuments({ eventId: req.params.id });
  if (count > 0) {
    return res.status(409).json({
      success: false,
      message: `Can't delete this event — it has ${count} registration${count === 1 ? "" : "s"}. Archive it instead.`,
      code: "EVENT_HAS_REGISTRATIONS",
    });
  }

  await Event.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}

module.exports = {
  listEvents,
  getEvent,
  getEventBySlug,
  createEvent,
  updateEvent,
  updateEventStatus,
  duplicateEvent,
  deleteEvent,
};