const { nanoid } = require("nanoid");
const EventForm = require("../models/EventForm");

async function getForm(req, res) {
  let form = await EventForm.findOne({ eventId: req.params.eventId });
  if (!form) {
    // return an empty-but-valid shape rather than 404 — most events will
    // build their form from scratch via the admin UI
    return res.json({ success: true, data: { eventId: req.params.eventId, fields: [] } });
  }
  res.json({ success: true, data: form });
}

async function saveForm(req, res) {
  const { fields } = req.body || {};
  if (!Array.isArray(fields)) {
    return res.status(400).json({ success: false, message: "fields must be an array" });
  }

  // assign a stable fieldId to any new field that doesn't have one yet
  const normalized = fields.map((f, i) => ({
    ...f,
    fieldId: f.fieldId || nanoid(10),
    order: f.order ?? i,
  }));

  const form = await EventForm.findOneAndUpdate(
    { eventId: req.params.eventId },
    { eventId: req.params.eventId, fields: normalized },
    { upsert: true, new: true }
  );

  res.json({ success: true, data: form });
}

module.exports = { getForm, saveForm };
