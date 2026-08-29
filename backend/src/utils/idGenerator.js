const { customAlphabet } = require("nanoid");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const shortId = customAlphabet(alphabet, 8);

// REG-2026-000123 style — sequential-looking but generated per event+year
// via a counter would need a Counter collection for true sequential
// numbers; for now use a random 6-digit suffix, unique-checked on insert.
function generateRegistrationId(year = new Date().getFullYear()) {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `REG-${year}-${suffix}`;
}

// TKT-STAR-38AAD2E4 — event code + random alphanumeric suffix
function generateTicketId(eventCode) {
  return `TKT-${eventCode}-${shortId()}`;
}

module.exports = { generateRegistrationId, generateTicketId };
