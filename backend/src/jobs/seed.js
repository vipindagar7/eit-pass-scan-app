require("dotenv").config();
const bcrypt = require("bcryptjs");
const { connectDb } = require("../config/db");
const User = require("../models/User");
const Event = require("../models/Event");
const EventForm = require("../models/EventForm");

const adminemail = process.env.adminemail
const adminpass = process.env.adminpass

async function seed() {
  await connectDb();

  const existingAdmin = await User.findOne({ role: "SUPER_ADMIN" });
  let admin = existingAdmin;
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminpass, 10);
    admin = await User.create({
      name: "Super Admin",
      email: adminemail,
      passwordHash,
      role: "SUPER_ADMIN",
    });
    console.log(`[seed] created Super Admin — email:${adminemail}/ password:${adminpass}`);
  } else {
    console.log("[seed] Super Admin already exists, skipping");
  }

  const sampleEvents = [
    { eventCode: "SAMARAMBH2026", name: "Samarambh 2026" },
    { eventCode: "HACKATHON2026", name: "Hackathon 2026" },
    { eventCode: "STARNIGHT2026", name: "Star Night 2026" },
  ];

  for (const sample of sampleEvents) {
    const exists = await Event.findOne({ eventCode: sample.eventCode });
    if (exists) {
      console.log(`[seed] event ${sample.eventCode} already exists, skipping`);
      continue;
    }

    const slug = sample.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const event = await Event.create({
      eventCode: sample.eventCode,
      name: sample.name,
      slug,
      status: "PUBLISHED",
      venue: "Main Campus",
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      registrationStart: new Date(),
      registrationEnd: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      uniqueField: "email",
      createdBy: admin._id,
    });

    await EventForm.create({
      eventId: event._id,
      fields: [
        { fieldId: "name", label: "Full Name", name: "name", type: "TEXT", required: true, order: 0 },
        { fieldId: "email", label: "Email", name: "email", type: "EMAIL", required: true, order: 1 },
        { fieldId: "phone", label: "Phone", name: "phone", type: "PHONE", required: true, order: 2 },
        { fieldId: "college", label: "College", name: "college", type: "TEXT", required: true, order: 3 },
      ],
    });

    console.log(`[seed] created event: ${sample.name} (${event.slug})`);
  }

  console.log("[seed] done");
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
