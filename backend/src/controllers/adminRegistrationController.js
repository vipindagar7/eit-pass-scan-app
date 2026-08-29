const { parse } = require("csv-parse/sync");
const Event = require("../models/Event");
const { createRegistrationDirect } = require("../services/importService");
const { logAction } = require("../utils/auditLog");

// POST /api/events/:eventId/registrations/manual — one registration, entered by an admin
async function createManualRegistration(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });

  const result = await createRegistrationDirect(event, req.body || {});
  if (result.skipped) {
    return res.status(409).json({ success: false, message: result.reason });
  }

  await logAction(req, "REGISTRATION_ADDED_MANUALLY", "Registration", result.registration._id);

  res.json({ success: true, data: { registrationId: result.registration.registrationId } });
}

// POST /api/events/:eventId/registrations/bulk — CSV upload
// Body: { csv: "<raw csv text>", fieldMap: { ourField: "csvColumnName" } }
async function createBulkRegistrations(req, res) {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ success: false, message: "Event not found" });

  const { csv, fieldMap } = req.body || {};
  if (!csv) return res.status(400).json({ success: false, message: "csv text is required" });

  let rows;
  try {
    rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: `Couldn't parse CSV: ${err.message}` });
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const customFields = {};
      const map = fieldMap && Object.keys(fieldMap).length ? fieldMap : null;

      if (map) {
        for (const [ourField, csvColumn] of Object.entries(map)) {
          if (row[csvColumn] !== undefined) customFields[ourField] = row[csvColumn];
        }
      } else {
        // no explicit mapping given — assume CSV column names already
        // match the event's field names directly
        Object.assign(customFields, row);
      }

      const result = await createRegistrationDirect(event, customFields);
      if (result.skipped) skipped++;
      else imported++;
    } catch (err) {
      failed++;
      errors.push(err.message);
    }
  }

  await logAction(req, "BULK_REGISTRATIONS_IMPORTED", "Event", event._id, { imported, skipped, failed });

  res.json({ success: true, data: { totalRows: rows.length, imported, skipped, failed, errors: errors.slice(0, 20) } });
}

module.exports = { createManualRegistration, createBulkRegistrations };