const { registerForEvent } = require("../services/registrationService");
const { queueEmail } = require("../services/emailService");
const Registration = require("../models/Registration");
const Ticket = require("../models/Ticket");
const DataSource = require("../models/DataSource");
const externalStorage = require("../services/externalStorageService");

const DEFAULT_CONFIRMATION_TEMPLATE = `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
    <h2>Hello {{name}},</h2>
    <p>Your registration for <strong>{{eventName}}</strong> has been confirmed.</p>
    <p>Registration ID: <strong>{{registrationId}}</strong><br/>
       Ticket ID: <strong>{{ticketId}}</strong></p>
    <p>View your ticket: <a href="{{ticketUrl}}">{{ticketUrl}}</a></p>
  </div>
`;

// POST /api/events/:eventId/register — public, no auth
async function submitRegistration(req, res) {
  const result = await registerForEvent(req.params.eventId, req.body || {});

  if (result.error) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error,
      errors: result.errors,
      code: "REGISTRATION_FAILED",
    });
  }

  // fire the confirmation email — doesn't block the response, and doesn't
  // fail registration if SMTP isn't configured/reachable
  const email = result.registration.customFields?.email;
  if (email) {
    queueEmail({
      to: email,
      subject: `You're registered — ${result.event.name}`,
      html: DEFAULT_CONFIRMATION_TEMPLATE,
      eventId: result.event._id,
      type: "REGISTRATION_CONFIRMATION",
      vars: {
        name: result.registration.customFields?.name || "there",
        eventName: result.event.name,
        registrationId: result.registration.registrationId,
        ticketId: result.ticket.ticketId,
        ticketUrl: `${process.env.FRONTEND_URL}/ticket/${result.ticket.ticketId}`,
      },
    }).catch((err) => console.error("[email] confirmation send failed:", err.message));
  }

  res.json({
    success: true,
    data: {
      registrationId: result.registration.registrationId,
      ticketId: result.ticket.ticketId,
      eventName: result.event.name,
    },
  });
}

// GET /api/events/:eventId/registrations — admin, paginated
// Shows data from wherever it actually lives: this platform's own
// Registration collection normally, or a live read from the external
// source directly if this event has an "external"-mode data source.
async function listRegistrations(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 25);
  const search = (req.query.search || "").trim().toLowerCase();

  const externalSource = await DataSource.findOne({ eventId: req.params.eventId, storageMode: "external" });

  if (externalSource) {
    try {
      let records = await externalStorage.readAllExternal(externalSource);

      if (search) {
        records = records.filter(
          (r) =>
            (r.ticketId || "").toLowerCase().includes(search) ||
            Object.values(r.customFields || {}).some((v) => String(v).toLowerCase().includes(search))
        );
      }

      const total = records.length;
      const paged = records
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice((page - 1) * limit, page * limit);

      return res.json({
        success: true,
        data: paged,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        source: "external",
      });
    } catch (err) {
      console.error("[registrations] external read failed:", err.message);
      return res.status(502).json({ success: false, message: `Couldn't read from external source: ${err.message}` });
    }
  }

  const filter = { eventId: req.params.eventId };
  if (search) {
    filter.$or = [
      { registrationId: new RegExp(search, "i") },
      { uniqueValue: new RegExp(search, "i") },
    ];
  }

  const [total, registrations] = await Promise.all([
    Registration.countDocuments(filter),
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    success: true,
    data: registrations,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    source: "internal",
  });
}

// PATCH /api/events/:eventId/registrations/:recordId — edits customFields,
// wherever this event's data actually lives. Checks the event's configured
// uniqueField isn't being changed to a value another record already has.
async function updateRegistration(req, res) {
  const Event = require("../models/Event");
  const event = await Event.findById(req.params.eventId);
  const uniqueFieldName = event?.uniqueField || "email";
  const customFields = req.body?.customFields || {};

  const externalSource = await DataSource.findOne({ eventId: req.params.eventId, storageMode: "external" });

  if (externalSource) {
    try {
      if (customFields[uniqueFieldName] !== undefined) {
        const newValue = String(customFields[uniqueFieldName]).trim();
        const existing = await externalStorage.findExternalRecord(externalSource, { manualValue: newValue });
        if (existing) {
          const existingId =
            externalSource.type === "mongodb" ? String(existing._id) : String(existing[externalSource.externalFieldNames.primaryKeyColumn]);
          if (existingId !== req.params.recordId) {
            return res.status(409).json({ success: false, message: `Another registration already uses this ${uniqueFieldName}` });
          }
        }
      }

      await externalStorage.updateExternalRecord(externalSource, req.params.recordId, customFields);
      return res.json({ success: true });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Couldn't update: ${err.message}` });
    }
  }

  if (customFields[uniqueFieldName] !== undefined) {
    const newValue = String(customFields[uniqueFieldName]).toLowerCase().trim();
    const existing = await Registration.findOne({
      eventId: req.params.eventId,
      uniqueValue: newValue,
      _id: { $ne: req.params.recordId },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: `Another registration already uses this ${uniqueFieldName}` });
    }
  }

  const update = { customFields };
  if (customFields[uniqueFieldName] !== undefined) {
    update.uniqueValue = String(customFields[uniqueFieldName]).toLowerCase().trim();
  }

  const registration = await Registration.findByIdAndUpdate(req.params.recordId, { $set: update }, { new: true });
  if (!registration) return res.status(404).json({ success: false, message: "Registration not found" });
  res.json({ success: true, data: registration });
}

// DELETE /api/events/:eventId/registrations/:recordId
async function deleteRegistration(req, res) {
  const externalSource = await DataSource.findOne({ eventId: req.params.eventId, storageMode: "external" });

  if (externalSource) {
    try {
      await externalStorage.deleteExternalRecord(externalSource, req.params.recordId);
      return res.json({ success: true });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Couldn't delete: ${err.message}` });
    }
  }

  await Registration.findByIdAndDelete(req.params.recordId);
  res.json({ success: true });
}

// GET /api/tickets/:ticketId — for the ticket display page
async function getTicket(req, res) {
  const ticket = await Ticket.findOne({ ticketId: req.params.ticketId }).populate("eventId").populate("registrationId");
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

  res.json({
    success: true,
    data: {
      ticketId: ticket.ticketId,
      status: ticket.status,
      ticketType: ticket.ticketType,
      qrToken: ticket.qrToken,
      event: {
        name: ticket.eventId.name,
        venue: ticket.eventId.venue,
        startDate: ticket.eventId.startDate,
        logo: ticket.eventId.logo,
      },
      registration: {
        registrationId: ticket.registrationId.registrationId,
        customFields: ticket.registrationId.customFields,
      },
    },
  });
}

module.exports = { submitRegistration, listRegistrations, updateRegistration, deleteRegistration, getTicket };