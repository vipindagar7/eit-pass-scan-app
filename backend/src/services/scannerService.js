const Ticket = require("../models/Ticket");
const Registration = require("../models/Registration");
const Attendance = require("../models/Attendance");
const qrToken = require("../utils/qrToken");

// Looks up a ticket by scanned QR token, or by manual search value
// (ticketId / email / phone) as a fallback when scanning isn't possible.
async function resolveTicket({ qrTokenValue, manualValue, eventId }) {
  let ticket = null;

  if (qrTokenValue) {
    const decoded = qrToken.verify(qrTokenValue);
    if (!decoded) {
      return { error: "This QR code is invalid or has been tampered with", code: "INVALID_QR" };
    }
    ticket = await Ticket.findOne({ ticketId: decoded.ticketId });

    // the QR's own embedded eventId must match what it decodes to — this
    // catches tampering; the *cross-event* rejection below additionally
    // catches a genuinely valid ticket from a DIFFERENT event being
    // scanned at the wrong event's gate
    if (ticket && String(ticket.eventId) !== decoded.eventId) {
      return { error: "QR token does not match its ticket", code: "TOKEN_MISMATCH" };
    }
  } else if (manualValue) {
    const registration = await Registration.findOne({
      eventId,
      $or: [{ uniqueValue: manualValue.toLowerCase().trim() }],
    });

    ticket =
      (await Ticket.findOne({ ticketId: manualValue, eventId })) ||
      (registration && (await Ticket.findOne({ registrationId: registration._id, eventId })));
  }

  if (!ticket) {
    return { error: "No matching ticket found", code: "TICKET_NOT_FOUND" };
  }

  // reject tickets belonging to another event, even if otherwise valid
  if (String(ticket.eventId) !== String(eventId)) {
    return { error: "This ticket is not valid for this event", code: "WRONG_EVENT" };
  }

  if (ticket.status !== "ACTIVE") {
    return { error: "This ticket has been cancelled", code: "TICKET_CANCELLED" };
  }

  return { ticket };
}

// Marks a ticket IN or OUT. Atomic and safe against two scanners hitting
// this at the same instant: the conditional findOneAndUpdate (only
// succeeds if currentCheckStatus is what we expect it to be beforehand)
// is the actual atomic operation — if two requests race, only one can
// win the flip from OUT/null -> IN (or IN -> OUT), and the loser gets
// told the ticket is already in that state. Every successful flip also
// appends a permanent entry to the Attendance log, so re-entry history
// (in, out, back in again, etc) is fully preserved.
async function markAttendance({ ticket, action, scannerId, gateId, performedBy, method = "QR", metadata = {} }) {
  const fromStatus = action === "IN" ? { $ne: "IN" } : "IN"; // check-in: anything but already-IN; check-out: must currently be IN

  const updated = await Ticket.findOneAndUpdate(
    { _id: ticket._id, currentCheckStatus: fromStatus },
    { $set: { currentCheckStatus: action } },
    { new: true }
  );

  if (!updated) {
    // the conditional update didn't match — ticket is already in the
    // state being requested (or, for check-out, was never checked in)
    const lastEntry = await Attendance.findOne({ ticketId: ticket._id }).sort({ at: -1 }).populate("gateId").populate("performedBy", "name");
    return {
      applied: false,
      currentStatus: ticket.currentCheckStatus,
      lastEntry,
    };
  }

  const entry = await Attendance.create({
    eventId: ticket.eventId,
    ticketId: ticket._id,
    registrationId: ticket.registrationId,
    type: action,
    scannerId,
    gateId,
    performedBy,
    method,
    metadata,
  });

  const history = await Attendance.find({ ticketId: ticket._id }).sort({ at: 1 }).populate("gateId").populate("performedBy", "name");

  return { applied: true, entry, history, currentStatus: action };
}

module.exports = { resolveTicket, markAttendance };