const { MongoClient } = require("mongodb");
const { Pool } = require("pg");
const DataSource = require("../models/DataSource");
const { runImport } = require("../services/importService");
const { startLiveSync, stopLiveSync } = require("../services/liveSyncManager");
const { logAction } = require("../utils/auditLog");

// POST /api/events/:eventId/data-sources/preview
// Body: { type, connectionUrl, dbName, collectionName, tableName }
// Connects to the external source (nothing is saved yet) and returns the
// available field/column names, plus one sample record, so the admin can
// map fields by picking from a list instead of typing raw JSON.
async function previewDataSource(req, res) {
  const { type, connectionUrl, dbName, collectionName, tableName } = req.body || {};

  if (!type || !connectionUrl) {
    return res.status(400).json({ success: false, message: "type and connectionUrl are required" });
  }

  try {
    if (type === "mongodb") {
      if (!dbName || !collectionName) {
        return res.status(400).json({ success: false, message: "dbName and collectionName are required" });
      }
      const client = new MongoClient(connectionUrl, { serverSelectionTimeoutMS: 8000 });
      await client.connect();
      const sample = await client.db(dbName).collection(collectionName).findOne({});
      await client.close();

      if (!sample) {
        return res.json({
          success: true,
          data: { fields: [], sample: null, note: "Collection is empty — connected fine, but no documents to detect fields from." },
        });
      }
      const fields = Object.keys(sample).filter((k) => k !== "_id");
      return res.json({ success: true, data: { fields, sample } });
    }

    if (type === "postgres") {
      if (!tableName) {
        return res.status(400).json({ success: false, message: "tableName is required" });
      }
      const pool = new Pool({ connectionString: connectionUrl, connectionTimeoutMillis: 8000 });
      const result = await pool.query(`SELECT * FROM ${tableName} LIMIT 1`);
      const columnsResult = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [
        tableName.split(".").pop(),
      ]);
      await pool.end();

      const fields = columnsResult.rows.map((r) => r.column_name);
      return res.json({ success: true, data: { fields, sample: result.rows[0] || null } });
    }

    return res.status(400).json({ success: false, message: `Unsupported type: ${type}` });
  } catch (err) {
    console.error("[data-source] preview failed:", err.message);
    res.status(502).json({ success: false, message: `Couldn't connect: ${err.message}` });
  }
}

async function listDataSources(req, res) {
  // never send the raw connection URL back to the client after creation —
  // it may contain a password
  const sources = await DataSource.find({ eventId: req.params.eventId }).select("-connectionUrl").sort({ createdAt: -1 });
  res.json({ success: true, data: sources });
}

async function createDataSource(req, res) {
  const { name, type, connectionUrl, dbName, collectionName, tableName, fieldMap, storageMode, externalFieldNames } =
    req.body || {};

  if (!name || !type || !connectionUrl) {
    return res.status(400).json({ success: false, message: "name, type, and connectionUrl are required" });
  }
  if (type === "mongodb" && (!dbName || !collectionName)) {
    return res.status(400).json({ success: false, message: "dbName and collectionName are required for MongoDB" });
  }
  if (type === "postgres" && !tableName) {
    return res.status(400).json({ success: false, message: "tableName is required for Postgres" });
  }

  const source = await DataSource.create({
    eventId: req.params.eventId,
    name,
    type,
    connectionUrl,
    dbName,
    collectionName,
    tableName,
    fieldMap: fieldMap || {},
    storageMode: storageMode === "external" ? "external" : "import",
    externalFieldNames: externalFieldNames || undefined, // let schema defaults apply if not given
    createdBy: req.user.id,
  });

  await logAction(req, "DATA_SOURCE_CREATED", "DataSource", source._id, { type, name, storageMode: source.storageMode });

  const safe = source.toObject();
  delete safe.connectionUrl;
  res.json({ success: true, data: safe });
}

async function updateDataSource(req, res) {
  const update = { ...req.body };
  const source = await DataSource.findByIdAndUpdate(req.params.dataSourceId, update, { new: true }).select("-connectionUrl");
  if (!source) return res.status(404).json({ success: false, message: "Data source not found" });
  res.json({ success: true, data: source });
}

async function deleteDataSource(req, res) {
  await stopLiveSync(req.params.dataSourceId);
  await DataSource.findByIdAndDelete(req.params.dataSourceId);
  res.json({ success: true });
}

// POST /api/events/:eventId/data-sources/:dataSourceId/live-sync
// Body: { enabled: true/false }
// Enabling does one immediate backlog import (so nothing is missed for
// data that already existed) and then starts the live watcher — no
// separate manual "run import" step needed at all.
async function toggleLiveSync(req, res) {
  const { enabled } = req.body || {};
  const source = await DataSource.findById(req.params.dataSourceId);
  if (!source) return res.status(404).json({ success: false, message: "Data source not found" });

  if (enabled) {
    try {
      const summary = await runImport(source); // catch up on existing rows first
      source.lastImportedAt = new Date();
      source.lastImportSummary = summary;

      await startLiveSync(source);
      source.liveSyncEnabled = true;
      await source.save();

      await logAction(req, "LIVE_SYNC_ENABLED", "DataSource", source._id, summary);
      res.json({ success: true, data: { liveSyncEnabled: true, backlogImport: summary } });
    } catch (err) {
      console.error("[live-sync] enable failed:", err.message);
      res.status(502).json({
        success: false,
        message: `Couldn't start live sync: ${err.message}${
          source.type === "mongodb"
            ? " (MongoDB Change Streams require the source to be a replica set)"
            : ""
        }`,
      });
    }
  } else {
    await stopLiveSync(source._id);
    source.liveSyncEnabled = false;
    await source.save();
    await logAction(req, "LIVE_SYNC_DISABLED", "DataSource", source._id);
    res.json({ success: true, data: { liveSyncEnabled: false } });
  }
}

async function triggerImport(req, res) {
  const source = await DataSource.findById(req.params.dataSourceId); // needs connectionUrl, so no .select exclusion here
  if (!source) return res.status(404).json({ success: false, message: "Data source not found" });

  try {
    const summary = await runImport(source);
    source.lastImportedAt = new Date();
    source.lastImportSummary = summary;
    await source.save();

    await logAction(req, "DATA_SOURCE_IMPORTED", "DataSource", source._id, summary);

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error("[import] failed:", err.message);
    res.status(502).json({ success: false, message: `Import failed: ${err.message}` });
  }
}

module.exports = {
  listDataSources,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  triggerImport,
  toggleLiveSync,
  previewDataSource,
};