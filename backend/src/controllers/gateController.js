const Gate = require("../models/Gate");
const ScannerDevice = require("../models/ScannerDevice");
const { logAction } = require("../utils/auditLog");

async function listGates(req, res) {
  const gates = await Gate.find({ eventId: req.params.eventId }).sort({ createdAt: 1 });
  res.json({ success: true, data: gates });
}

async function createGate(req, res) {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: "Gate name is required" });

  const gate = await Gate.create({ eventId: req.params.eventId, name });
  await logAction(req, "GATE_CREATED", "Gate", gate._id, { name });
  res.json({ success: true, data: gate });
}

async function updateGate(req, res) {
  const { name, status } = req.body || {};
  const gate = await Gate.findByIdAndUpdate(req.params.gateId, { name, status }, { new: true });
  if (!gate) return res.status(404).json({ success: false, message: "Gate not found" });
  res.json({ success: true, data: gate });
}

async function deleteGate(req, res) {
  await Gate.findByIdAndDelete(req.params.gateId);
  res.json({ success: true });
}

async function listScanners(req, res) {
  const scanners = await ScannerDevice.find({ eventId: req.params.eventId })
    .populate("userId", "name email")
    .populate("gateId", "name")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: scanners });
}

async function createScanner(req, res) {
  const { userId, gateId, deviceName } = req.body || {};
  if (!userId || !gateId) {
    return res.status(400).json({ success: false, message: "userId and gateId are required" });
  }
  const scanner = await ScannerDevice.create({ eventId: req.params.eventId, userId, gateId, deviceName });
  await logAction(req, "SCANNER_ASSIGNED", "ScannerDevice", scanner._id, { userId, gateId });
  res.json({ success: true, data: scanner });
}

async function revokeScanner(req, res) {
  const scanner = await ScannerDevice.findByIdAndUpdate(
    req.params.scannerId,
    { status: "REVOKED" },
    { new: true }
  );
  if (!scanner) return res.status(404).json({ success: false, message: "Scanner not found" });
  await logAction(req, "SCANNER_REVOKED", "ScannerDevice", scanner._id);
  res.json({ success: true, data: scanner });
}

module.exports = { listGates, createGate, updateGate, deleteGate, listScanners, createScanner, revokeScanner };
