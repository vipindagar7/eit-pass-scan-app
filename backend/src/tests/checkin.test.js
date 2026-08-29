const Event = require("../models/Event");
const EventForm = require("../models/EventForm");
const { registerForEvent } = require("../services/registrationService");
const { resolveTicket, checkIn } = require("../services/scannerService");

async function makeEvent(overrides = {}) {
  return Event.create({
    eventCode: `EVT${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name: "Test Event",
    slug: `test-event-${Date.now()}-${Math.random()}`,
    status: "REGISTRATION_OPEN",
    uniqueField: "email",
    ...overrides,
  });
}

async function makeForm(eventId) {
  return EventForm.create({
    eventId,
    fields: [
      { fieldId: "name", label: "Name", name: "name", type: "TEXT", required: true, order: 0 },
      { fieldId: "email", label: "Email", name: "email", type: "EMAIL", required: true, order: 1 },
    ],
  });
}

describe("Check-in", () => {
  test("a valid ticket checks in successfully", async () => {
    const event = await makeEvent();
    await makeForm(event._id);
    const reg = await registerForEvent(event._id, { name: "Alice", email: "alice@test.com" });

    const resolved = await resolveTicket({ manualValue: reg.ticket.ticketId, eventId: event._id });
    expect(resolved.error).toBeUndefined();

    const result = await checkIn({ ticket: resolved.ticket, method: "MANUAL" });
    expect(result.alreadyCheckedIn).toBe(false);
  });

  test("scanning the same ticket a second time reports already-checked-in", async () => {
    const event = await makeEvent();
    await makeForm(event._id);
    const reg = await registerForEvent(event._id, { name: "Bob", email: "bob@test.com" });

    const resolved = await resolveTicket({ manualValue: reg.ticket.ticketId, eventId: event._id });
    await checkIn({ ticket: resolved.ticket, method: "MANUAL" });
    const second = await checkIn({ ticket: resolved.ticket, method: "MANUAL" });

    expect(second.alreadyCheckedIn).toBe(true);
  });

  test("a ticket from Event A is rejected when scanned at Event B's gate", async () => {
    const eventA = await makeEvent({ name: "Event A" });
    const eventB = await makeEvent({ name: "Event B" });
    await makeForm(eventA._id);

    const reg = await registerForEvent(eventA._id, { name: "Carol", email: "carol@test.com" });

    const resolved = await resolveTicket({ manualValue: reg.ticket.ticketId, eventId: eventB._id });
    expect(resolved.error).toBe("This ticket is not valid for this event");
    expect(resolved.code).toBe("WRONG_EVENT");
  });

  test("manual check-in (no QR) works and is logged with method MANUAL", async () => {
    const event = await makeEvent();
    await makeForm(event._id);
    const reg = await registerForEvent(event._id, { name: "Dan", email: "dan@test.com" });

    const resolved = await resolveTicket({ manualValue: "dan@test.com", eventId: event._id });
    expect(resolved.error).toBeUndefined();

    const result = await checkIn({ ticket: resolved.ticket, method: "MANUAL" });
    expect(result.attendance.method).toBe("MANUAL");
  });

  // *** THE critical test the spec explicitly calls out ***
  // Two "scanners" fire the exact same check-in for the same ticket at
  // effectively the same instant. Only ONE must ever succeed — this is
  // what the unique index on Attendance.ticketId is there to guarantee,
  // and it's a real correctness property, not just a happy-path check.
  test("simultaneous check-in attempts on the same ticket — exactly one succeeds", async () => {
    const event = await makeEvent();
    await makeForm(event._id);
    const reg = await registerForEvent(event._id, { name: "Eve", email: "eve@test.com" });

    const resolved = await resolveTicket({ manualValue: reg.ticket.ticketId, eventId: event._id });

    // fire both "scans" concurrently — this is the actual race condition
    const [resultA, resultB] = await Promise.all([
      checkIn({ ticket: resolved.ticket, method: "QR", scannerId: "scanner-A" }),
      checkIn({ ticket: resolved.ticket, method: "QR", scannerId: "scanner-B" }),
    ]);

    const successCount = [resultA, resultB].filter((r) => r.alreadyCheckedIn === false).length;
    const duplicateCount = [resultA, resultB].filter((r) => r.alreadyCheckedIn === true).length;

    expect(successCount).toBe(1);
    expect(duplicateCount).toBe(1);

    // and only one Attendance document should actually exist for this ticket
    const Attendance = require("../models/Attendance");
    const count = await Attendance.countDocuments({ ticketId: resolved.ticket._id });
    expect(count).toBe(1);
  });
});
