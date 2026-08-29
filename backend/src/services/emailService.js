const nodemailer = require("nodemailer");
const Notification = require("../models/Notification");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return transporter;
}

function renderTemplate(html, vars) {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// This is the "queue abstraction" the spec asks for: every send goes
// through here and is recorded as a Notification row with a status. Right
// now it sends immediately (no Redis/BullMQ required to run this app),
// but a real background worker could later just watch for PENDING
// Notification rows and call sendNow() on them — nothing calling
// queueEmail() would need to change.
async function queueEmail({ to, subject, html, eventId, type, vars = {} }) {
  const rendered = renderTemplate(html, vars);

  const notification = await Notification.create({
    eventId,
    to,
    subject,
    type,
    status: "PENDING",
  });

  try {
    await sendNow({ to, subject, html: rendered });
    notification.status = "SENT";
    notification.sentAt = new Date();
  } catch (err) {
    notification.status = "FAILED";
    notification.failReason = err.message;
  }
  await notification.save();

  return notification;
}

async function sendNow({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    throw new Error("SMTP is not configured");
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
}

module.exports = { queueEmail, renderTemplate };
