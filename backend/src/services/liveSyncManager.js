const { MongoClient } = require("mongodb");
const { Pool } = require("pg");
const DataSource = require("../models/DataSource");
const { createRegistrationDirect } = require("./importService");
const Event = require("../models/Event");

// active watchers/intervals, keyed by dataSource._id (string)
const activeWatchers = new Map();

function mapRow(row, fieldMap) {
  const mapped = {};
  for (const [ourField, externalField] of Object.entries(fieldMap || {})) {
    if (externalField && row[externalField] !== undefined) mapped[ourField] = row[externalField];
  }
  return mapped;
}

async function importOneRow(dataSourceDoc, row) {
  const event = await Event.findById(dataSourceDoc.eventId);
  if (!event) return;
  const customFields = mapRow(row, dataSourceDoc.fieldMap);
  try {
    await createRegistrationDirect(event, customFields);
  } catch (err) {
    console.error(`[live-sync] failed to import a row for data source ${dataSourceDoc._id}:`, err.message);
  }
}

async function startMongoWatch(dataSourceDoc) {
  const client = new MongoClient(dataSourceDoc.connectionUrl);
  await client.connect();
  const collection = client.db(dataSourceDoc.dbName).collection(dataSourceDoc.collectionName);

  // requires the source MongoDB to be a replica set — will throw
  // otherwise, which the caller surfaces back to the admin
  const changeStream = collection.watch([{ $match: { operationType: "insert" } }]);

  changeStream.on("change", (change) => {
    importOneRow(dataSourceDoc, change.fullDocument).catch(() => {});
  });
  changeStream.on("error", (err) => {
    console.error(`[live-sync] change stream error for ${dataSourceDoc._id}:`, err.message);
  });

  return {
    stop: async () => {
      await changeStream.close().catch(() => {});
      await client.close().catch(() => {});
    },
  };
}

function startPostgresPoll(dataSourceDoc) {
  const pool = new Pool({ connectionString: dataSourceDoc.connectionUrl });
  // tracks rows we've already seen this session so we don't re-import on
  // every poll tick — combined with the uniqueValue duplicate check in
  // createRegistrationDirect as the real source of truth
  let lastRowCount = 0;

  const interval = setInterval(async () => {
    try {
      const result = await pool.query(`SELECT * FROM ${dataSourceDoc.tableName}`);
      if (result.rows.length > lastRowCount) {
        const newRows = result.rows.slice(lastRowCount);
        for (const row of newRows) {
          await importOneRow(dataSourceDoc, row);
        }
      }
      lastRowCount = result.rows.length;
    } catch (err) {
      console.error(`[live-sync] postgres poll error for ${dataSourceDoc._id}:`, err.message);
    }
  }, 10000); // every 10s — as close to "live" as polling reasonably gets

  return {
    stop: async () => {
      clearInterval(interval);
      await pool.end().catch(() => {});
    },
  };
}

async function startLiveSync(dataSourceDoc) {
  const key = String(dataSourceDoc._id);
  if (activeWatchers.has(key)) return; // already running

  const handle =
    dataSourceDoc.type === "mongodb" ? await startMongoWatch(dataSourceDoc) : startPostgresPoll(dataSourceDoc);

  activeWatchers.set(key, handle);
}

async function stopLiveSync(dataSourceId) {
  const key = String(dataSourceId);
  const handle = activeWatchers.get(key);
  if (handle) {
    await handle.stop();
    activeWatchers.delete(key);
  }
}

// Called once on server boot to resume live sync for any data source
// that had it enabled before the server restarted.
async function resumeAllLiveSyncs() {
  const sources = await DataSource.find({ liveSyncEnabled: true });
  for (const source of sources) {
    try {
      await startLiveSync(source);
      console.log(`[live-sync] resumed for data source ${source._id} (${source.name})`);
    } catch (err) {
      console.error(`[live-sync] couldn't resume ${source._id}:`, err.message);
    }
  }
}

module.exports = { startLiveSync, stopLiveSync, resumeAllLiveSyncs };