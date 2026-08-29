const crypto = require("crypto");

function sign(ticketId, eventId) {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error("QR_SECRET is not set in .env");
  const payload = `${ticketId}.${eventId}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  // what actually goes in the QR — just IDs + a short signature, never PII
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function verify(token) {
  try {
    const decoded = Buffer.from(token.trim(), "base64url").toString("utf8");
    const [ticketId, eventId, signature] = decoded.split(".");
    if (!ticketId || !eventId || !signature) return null;

    const secret = process.env.QR_SECRET;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${ticketId}.${eventId}`)
      .digest("hex")
      .slice(0, 16);

    if (signature !== expectedSignature) return null;
    return { ticketId, eventId };
  } catch {
    return null;
  }
}

module.exports = { sign, verify };