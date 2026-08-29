const mongoose = require("mongoose");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const Attendance = require("../models/Attendance");
const Ticket = require("../models/Ticket");
const DataSource = require("../models/DataSource");
const externalStorage = require("../services/externalStorageService");

// GET /api/events/:eventId/analytics
async function getEventAnalytics(req, res) {
  const eventId = new mongoose.Types.ObjectId(req.params.eventId);

  const externalSource = await DataSource.findOne({ eventId, storageMode: "external" });
  if (externalSource) {
    try {
      const records = await externalStorage.readAllExternal(externalSource);
      const totalRegistrations = records.length;
      const totalCheckedIn = records.filter((r) => r.checkedIn).length;

      const byDay = {};
      const checkInsByDayMap = {};
      for (const r of records) {
        if (r.createdAt) {
          const day = new Date(r.createdAt).toISOString().slice(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        }
        if (r.checkedIn && r.checkedInAt) {
          const day = new Date(r.checkedInAt).toISOString().slice(0, 10);
          checkInsByDayMap[day] = (checkInsByDayMap[day] || 0) + 1;
        }
      }
      const toSortedArray = (obj) =>
        Object.entries(obj)
          .map(([_id, count]) => ({ _id, count }))
          .sort((a, b) => a._id.localeCompare(b._id));

      return res.json({
        success: true,
        data: {
          totalRegistrations,
          totalCheckedIn,
          notCheckedIn: Math.max(0, totalRegistrations - totalCheckedIn),
          cancelled: 0,
          attendanceRate: totalRegistrations ? Number(((totalCheckedIn / totalRegistrations) * 100).toFixed(1)) : 0,
          registrationsByDay: toSortedArray(byDay),
          checkInsByDay: toSortedArray(checkInsByDayMap),
          checkInsByGate: [], // gate isn't tracked for externally-stored check-ins yet
          source: "external",
        },
      });
    } catch (err) {
      console.error("[analytics] external read failed:", err.message);
      return res.status(502).json({ success: false, message: `Couldn't read analytics from external source: ${err.message}` });
    }
  }

  const [totalRegistrations, totalCheckedIn, registrationsByDay, checkInsByDay, checkInsByGate] = await Promise.all([
    Registration.countDocuments({ eventId, status: { $ne: "CANCELLED" } }),
    Ticket.countDocuments({ eventId, currentCheckStatus: "IN" }), // currently inside, right now
    Registration.aggregate([
      { $match: { eventId } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: { eventId, type: "IN" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$at" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: { eventId, type: "IN" } },
      { $group: { _id: "$gateId", count: { $sum: 1 } } },
      { $lookup: { from: "gates", localField: "_id", foreignField: "_id", as: "gate" } },
      { $unwind: { path: "$gate", preserveNullAndEmptyArrays: true } },
      { $project: { gateName: { $ifNull: ["$gate.name", "Unassigned"] }, count: 1, _id: 0 } },
    ]),
  ]);

  const cancelled = await Registration.countDocuments({ eventId, status: "CANCELLED" });

  res.json({
    success: true,
    data: {
      totalRegistrations,
      totalCheckedIn,
      notCheckedIn: Math.max(0, totalRegistrations - totalCheckedIn),
      cancelled,
      attendanceRate: totalRegistrations ? Number(((totalCheckedIn / totalRegistrations) * 100).toFixed(1)) : 0,
      registrationsByDay,
      checkInsByDay,
      checkInsByGate,
      source: "internal",
    },
  });
}

// GET /api/analytics/overview — Super Admin cross-event summary cards
async function getOverview(req, res) {
  const [totalEvents, activeEvents, totalRegistrations, totalCheckedIn, totalUsers] = await Promise.all([
    Event.countDocuments(),
    Event.countDocuments({ status: { $in: ["PUBLISHED", "REGISTRATION_OPEN", "LIVE"] } }),
    Registration.countDocuments({ status: { $ne: "CANCELLED" } }),
    Ticket.countDocuments({ currentCheckStatus: "IN" }),
    require("../models/User").countDocuments(),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysCheckIns = await Attendance.countDocuments({ type: "IN", at: { $gte: todayStart } });

  res.json({
    success: true,
    data: { totalEvents, activeEvents, totalRegistrations, totalCheckedIn, totalUsers, todaysCheckIns },
  });
}

module.exports = { getEventAnalytics, getOverview };