// Mirrors the encoding in backend/src/utils/qrToken.js (base64url of
// "ticketId.eventId.signature") — but this only DECODES, it can't verify
// the signature client-side (that requires QR_SECRET, which never ships
// to the browser). This is an intentional, disclosed tradeoff: offline
// scans get looked up against the locally-cached registrant list instead
// of cryptographic verification. Once back online, everything is
// re-confirmed against the real server-side check.
export function decodeQrTokenOffline(token) {
  try {
    const decoded = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const [ticketId, eventId] = decoded.split(".");
    if (!ticketId || !eventId) return null;
    return { ticketId, eventId };
  } catch {
    return null;
  }
}