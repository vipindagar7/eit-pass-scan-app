const Event = require("../models/Event");
const EventForm = require("../models/EventForm");
const Registration = require("../models/Registration");
const Ticket = require("../models/Ticket");
const { generateRegistrationId, generateTicketId } = require("../utils/idGenerator");
const qrToken = require("../utils/qrToken");

// Validates submitted values against the event's dynamic form definition.
// Returns an array of error strings (empty if valid).
function validateAgainstForm(fields, values) {
  const errors = [];

  for (const field of fields) {
    if (!field.visible) continue;
    const value = values[field.name];

    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (value === undefined || value === null || value === "") continue;

    switch (field.type) {
      case "EMAIL":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field.label} must be a valid email`);
        break;
      case "PHONE":
        if (!/^\+?[0-9]{7,15}$/.test(String(value))) errors.push(`${field.label} must be a valid phone number`);
        break;
      case "NUMBER":
        if (Number.isNaN(Number(value))) errors.push(`${field.label} must be a number`);
        break;
      case "URL":
        try {
          new URL(value);
        } catch {
          errors.push(`${field.label} must be a valid URL`);
        }
        break;
      case "SELECT":
      case "RADIO":
        if (field.options?.length && !field.options.includes(value)) {
          errors.push(`${field.label} has an invalid selection`);
        }
        break;
      case "MULTI_SELECT":
      case "CHECKBOX":
        if (field.options?.length) {
          const vals = Array.isArray(value) ? value : [value];
          if (vals.some((v) => !field.options.includes(v))) {
            errors.push(`${field.label} has an invalid selection`);
          }
        }
        break;
      default:
        break;
    }

    if (field.validation?.pattern && typeof value === "string") {
      try {
        const re = new RegExp(field.validation.pattern);
        if (!re.test(value)) errors.push(`${field.label} is not in the expected format`);
      } catch {
        /* ignore bad admin-configured regex rather than blocking submission */
      }
    }
  }

  return errors;
}

async function registerForEvent(eventId, values) {
  const event = await Event.findById(eventId);
  if (!event) {
    return { error: "Event not found", status: 404 };
  }
  if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status)) {
    return { error: "Registration is not currently open for this event", status: 400 };
  }

  const form = await EventForm.findOne({ eventId });
  const fields = form?.fields || [];

  const errors = validateAgainstForm(fields, values || {});
  if (errors.length) {
    return { error: errors[0], errors, status: 400 };
  }

  const uniqueFieldName = event.uniqueField || "email";
  const uniqueValue = values[uniqueFieldName];
  if (!uniqueValue) {
    return { error: `${uniqueFieldName} is required`, status: 400 };
  }

  const existing = await Registration.findOne({
    eventId,
    uniqueValue: String(uniqueValue).toLowerCase().trim(),
  });
  if (existing) {
    return { error: "You're already registered for this event", status: 409 };
  }

  const registration = await Registration.create({
    eventId,
    registrationId: generateRegistrationId(),
    customFields: values,
    formSnapshot: fields,
    uniqueValue: String(uniqueValue).toLowerCase().trim(),
  });

  const ticketId = generateTicketId(event.eventCode);
  const token = qrToken.sign(ticketId, String(eventId));

  const ticket = await Ticket.create({
    eventId,
    registrationId: registration._id,
    ticketId,
    qrToken: token,
  });

  return { registration, ticket, event };
}

module.exports = { registerForEvent, validateAgainstForm };
