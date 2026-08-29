const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Event = require("../models/Event");
const EventForm = require("../models/EventForm");
const { registerForEvent } = require("../services/registrationService");
const qrToken = require("../utils/qrToken");

async function makeUser(role, assignedEvents = []) {
  const passwordHash = await bcrypt.hash("password123", 4);
  return User.create({
    name: "Test User",
    email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@test.com`,
    passwordHash,
    role,
    assignedEvents,
  });
}

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

describe("Auth", () => {
  test("password comparison correctly rejects wrong password", async () => {
    const user = await makeUser("SUPER_ADMIN");
    const ok = await bcrypt.compare("wrong-password", user.passwordHash);
    expect(ok).toBe(false);
  });

  test("JWT round-trips role and assignedEvents", async () => {
    const event = await makeEvent();
    const user = await makeUser("EVENT_ADMIN", [event._id]);
    const token = jwt.sign(
      { id: user._id, role: user.role, assignedEvents: user.assignedEvents },
      process.env.JWT_SECRET
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.role).toBe("EVENT_ADMIN");
    expect(decoded.assignedEvents.map(String)).toContain(String(event._id));
  });
});

describe("Event isolation", () => {
  test("an EVENT_ADMIN's assignedEvents does not include an unrelated event", async () => {
    const eventA = await makeEvent({ name: "Event A" });
    const eventB = await makeEvent({ name: "Event B" });
    const admin = await makeUser("EVENT_ADMIN", [eventA._id]);

    const assigned = admin.assignedEvents.map(String);
    expect(assigned).toContain(String(eventA._id));
    expect(assigned).not.toContain(String(eventB._id));
  });
});

describe("Dynamic form registration", () => {
  test("registration succeeds with valid data matching the dynamic form", async () => {
    const event = await makeEvent();
    await makeForm(event._id);

    const result = await registerForEvent(event._id, { name: "Alice", email: "alice@test.com" });
    expect(result.error).toBeUndefined();
    expect(result.registration.registrationId).toMatch(/^REG-/);
    expect(result.ticket.ticketId).toMatch(/^TKT-/);
  });

  test("registration fails when a required dynamic field is missing", async () => {
    const event = await makeEvent();
    await makeForm(event._id);

    const result = await registerForEvent(event._id, { name: "Bob" }); // missing email
    expect(result.error).toBeDefined();
    expect(result.status).toBe(400);
  });

  test("duplicate registration (same uniqueField value) is rejected", async () => {
    const event = await makeEvent();
    await makeForm(event._id);

    await registerForEvent(event._id, { name: "Carol", email: "carol@test.com" });
    const second = await registerForEvent(event._id, { name: "Carol Again", email: "carol@test.com" });

    expect(second.error).toBeDefined();
    expect(second.status).toBe(409);
  });

  test("registration is rejected when the event isn't open for registration", async () => {
    const event = await makeEvent({ status: "DRAFT" });
    await makeForm(event._id);

    const result = await registerForEvent(event._id, { name: "Dan", email: "dan@test.com" });
    expect(result.error).toBeDefined();
    expect(result.status).toBe(400);
  });
});

describe("QR token security", () => {
  test("a signed QR token verifies successfully and decodes the right ticket/event", async () => {
    const event = await makeEvent();
    const token = qrToken.sign("TKT-TEST-ABC123", String(event._id));
    const decoded = qrToken.verify(token);
    expect(decoded.ticketId).toBe("TKT-TEST-ABC123");
    expect(decoded.eventId).toBe(String(event._id));
  });

  test("a tampered QR token fails verification", async () => {
    const event = await makeEvent();
    const token = qrToken.sign("TKT-TEST-ABC123", String(event._id));
    const tampered = token.slice(0, -2) + "xx";
    expect(qrToken.verify(tampered)).toBeNull();
  });

  test("no personal information is embedded in the QR token payload", async () => {
    const event = await makeEvent();
    await makeForm(event._id);
    const result = await registerForEvent(event._id, { name: "Eve", email: "eve@test.com" });

    const decodedPayload = Buffer.from(result.ticket.qrToken, "base64url").toString("utf8");
    expect(decodedPayload).not.toMatch(/Eve/);
    expect(decodedPayload).not.toMatch(/eve@test\.com/);
  });
});
