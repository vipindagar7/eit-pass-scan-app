const { resolveTicket, markAttendance } = require("../services/scannerService");
const Attendance = require("../models/Attendance");
const Registration = require("../models/Registration");
const Ticket = require("../models/Ticket");
const DataSource = require("../models/DataSource");
const externalStorage = require("../services/externalStorageService");
const qrToken = require("../utils/qrToken");
const { logAction } = require("../utils/auditLog");

// GET /api/events/:eventId/scan/offline-cache — a lean list of every
// registrant (ticketId + a display name + current status), for the
// scanner to download once and cache client-side (IndexedDB) so it can
// keep resolving/showing details while offline. Works for both storage
// modes.
async function getOfflineCache(req, res) {
  const externalSource = await DataSource.findOne({ eventId: req.params.eventId, storageMode: "external" });

  if (externalSource) {
    try {
      const records = await externalStorage.readAllExternal(externalSource);
      return res.json({
        success: true,
        data: records
          .filter((r) => r.ticketId)
          .map((r) => ({
            ticketId: r.ticketId,
            name: r.customFields?.name || Object.values(r.customFields || {})[0] || "",
            currentStatus: r.checkedIn ? "IN" : null,
          })),
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Couldn't load offline cache: ${err.message}` });
    }
  }

  const tickets = await Ticket.find({ eventId: req.params.eventId, status: "ACTIVE" }).select(
    "ticketId currentCheckStatus registrationId"
  );
  const registrations = await Registration.find({
    _id: { $in: tickets.map((t) => t.registrationId) },
  }).select("customFields");
  const regMap = new Map(registrations.map((r) => [String(r._id), r]));

  res.json({
    success: true,
    data: tickets.map((t) => ({
      ticketId: t.ticketId,
      name: regMap.get(String(t.registrationId))?.customFields?.name || "",
      currentStatus: t.currentCheckStatus,
    })),
  });
}

// POST /api/events/:eventId/scan/resolve — looks up and returns full
// details + current status, WITHOUT changing anything. This is what runs
// right after a QR scan or manual search, before the admin decides to
// check in or out.
async function scanResolve(req, res) {
  const { qrToken: qrTokenValue, manualValue } = req.body || {};
  const { eventId } = req.params;

  if (!qrTokenValue && !manualValue) {
    return res.status(400).json({ success: false, message: "Provide either qrToken or manualValue" });
  }

  const externalSource = await DataSource.findOne({ eventId, storageMode: "external" });
  if (externalSource) {
    return resolveExternal(req, res, externalSource, { qrTokenValue, manualValue });
  }

  const resolved = await resolveTicket({ qrTokenValue, manualValue, eventId });
  if (resolved.error) {
    return res.status(400).json({ success: false, message: resolved.error, code: resolved.code });
  }

  const registration = await Registration.findById(resolved.ticket.registrationId);
  const history = await Attendance.find({ ticketId: resolved.ticket._id })
    .sort({ at: 1 })
    .populate("gateId", "name")
    .populate("performedBy", "name");

  res.json({
    success: true,
    data: {
      ticketId: resolved.ticket.ticketId,
      customFields: registration?.customFields || {},
      currentStatus: resolved.ticket.currentCheckStatus, // "IN" | "OUT" | null
      history: history.map((h) => ({ type: h.type, at: h.at, gate: h.gateId?.name, by: h.performedBy?.name })),
    },
  });
}

// POST /api/events/:eventId/scan/mark — actually performs a check-in or
// check-out. Body: { qrToken } OR { manualValue }, { action: "IN"|"OUT" },
// plus optional { gateId, scannerId }
async function scanMark(req, res) {
  const { qrToken: qrTokenValue, manualValue, action, gateId, scannerId } = req.body || {};
  const { eventId } = req.params;

  if (!["IN", "OUT"].includes(action)) {
    return res.status(400).json({ success: false, message: "action must be IN or OUT" });
  }
  if (!qrTokenValue && !manualValue) {
    return res.status(400).json({ success: false, message: "Provide either qrToken or manualValue" });
  }

  const externalSource = await DataSource.findOne({ eventId, storageMode: "external" });
  if (externalSource) {
    return markExternal(req, res, externalSource, { qrTokenValue, manualValue, action, gateId });
  }

  const resolved = await resolveTicket({ qrTokenValue, manualValue, eventId });
  if (resolved.error) {
    return res.status(400).json({ success: false, message: resolved.error, code: resolved.code });
  }

  const result = await markAttendance({
    ticket: resolved.ticket,
    action,
    scannerId,
    gateId,
    performedBy: req.user.id,
    method: qrTokenValue ? "QR" : "MANUAL",
  });

  const registration = await Registration.findById(resolved.ticket.registrationId);

  if (!result.applied) {
    const message =
      action === "IN"
        ? "Already checked in"
        : result.currentStatus === "IN"
        ? "Couldn't check out — try again"
        : "Not currently checked in";
    return res.status(409).json({
      success: false,
      message,
      code: action === "IN" ? "ALREADY_CHECKED_IN" : "NOT_CHECKED_IN",
      data: {
        ticketId: resolved.ticket.ticketId,
        customFields: registration?.customFields || {},
        currentStatus: result.currentStatus,
        lastEntry: result.lastEntry
          ? { type: result.lastEntry.type, at: result.lastEntry.at, gate: result.lastEntry.gateId?.name }
          : null,
      },
    });
  }

  await logAction(req, action === "IN" ? "TICKET_CHECKED_IN" : "TICKET_CHECKED_OUT", "Ticket", resolved.ticket._id, { gateId });

  res.json({
    success: true,
    data: {
      ticketId: resolved.ticket.ticketId,
      customFields: registration?.customFields || {},
      currentStatus: result.currentStatus,
      history: result.history.map((h) => ({ type: h.type, at: h.at })),
    },
  });
}

async function resolveExternal(req, res, source, { qrTokenValue, manualValue }) {
  let ticketIdValue = null;
  if (qrTokenValue) {
    const decoded = qrToken.verify(qrTokenValue);
    if (!decoded || decoded.eventId !== String(source.eventId)) {
      return res.status(400).json({ success: false, message: "This QR code is invalid for this event" });
    }
    ticketIdValue = decoded.ticketId;
  }

  try {
    const record = await externalStorage.findExternalRecord(source, { ticketIdValue, manualValue });
    if (!record) return res.status(404).json({ success: false, message: "No matching registration found" });

    const names = source.externalFieldNames;
    const fm = source.fieldMap || {};
    const customFields = {};
    for (const [ourField, externalField] of Object.entries(fm)) {
      if (externalField && record[externalField] !== undefined) customFields[ourField] = record[externalField];
    }

    res.json({
      success: true,
      data: {
        ticketId: record[names.ticketId] || null,
        customFields,
        currentStatus: record[names.checkedIn] ? "IN" : null,
        history: record[names.checkedInAt] ? [{ type: "IN", at: record[names.checkedInAt] }] : [],
      },
    });
  } catch (err) {
    res.status(502).json({ success: false, message: `Couldn't look up: ${err.message}` });
  }
}

async function markExternal(req, res, source, { qrTokenValue, manualValue, action, gateId }) {
  // external mode only supports a single checked-in flag (see the
  // externalStorageService note) — check-out isn't tracked there
  if (action === "OUT") {
    return res.status(400).json({ success: false, message: "Check-out isn't supported for externally-stored registrations yet" });
  }

  let ticketIdValue = null;
  if (qrTokenValue) {
    const decoded = qrToken.verify(qrTokenValue);
    if (!decoded || decoded.eventId !== String(source.eventId)) {
      return res.status(400).json({ success: false, message: "This QR code is invalid for this event" });
    }
    ticketIdValue = decoded.ticketId;
  }

  try {
    const record = await externalStorage.findExternalRecord(source, { ticketIdValue, manualValue });
    if (!record) return res.status(404).json({ success: false, message: "No matching registration found" });

    const recordKey =
      source.type === "mongodb"
        ? record._id
        : { column: source.externalFieldNames.primaryKeyColumn, value: record[source.externalFieldNames.primaryKeyColumn] };

    await externalStorage.ensureExternalTicket(source, record, recordKey);
    const result = await externalStorage.markExternalCheckedIn(source, record, recordKey);

    const fm = source.fieldMap || {};
    const customFields = {};
    for (const [ourField, externalField] of Object.entries(fm)) {
      if (externalField && record[externalField] !== undefined) customFields[ourField] = record[externalField];
    }

    if (result.alreadyCheckedIn) {
      return res.status(409).json({
        success: false,
        message: "Already checked in",
        code: "ALREADY_CHECKED_IN",
        data: { customFields, currentStatus: "IN", lastEntry: { type: "IN", at: result.checkedInAt } },
      });
    }

    await logAction(req, "TICKET_CHECKED_IN_EXTERNAL", "DataSource", source._id, { gateId });

    res.json({ success: true, data: { customFields, currentStatus: "IN", history: [{ type: "IN", at: result.checkedInAt }] } });
  } catch (err) {
    res.status(502).json({ success: false, message: `Couldn't check in: ${err.message}` });
  }
}

// GET /api/events/:eventId/attendance — paginated attendance log
async function listAttendance(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 25);

  const filter = { eventId: req.params.eventId };
  const [total, records] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter)
      .populate("gateId", "name")
      .populate("performedBy", "name")
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({ success: true, data: records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

module.exports = { scanResolve, scanMark, listAttendance, getOfflineCache };