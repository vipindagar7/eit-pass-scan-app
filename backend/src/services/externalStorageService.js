const { MongoClient, ObjectId } = require("mongodb");
const { Pool } = require("pg");
const { generateTicketId } = require("../utils/idGenerator");
const qrToken = require("../utils/qrToken");

const mongoClients = new Map();
const pgPools = new Map();

async function getMongoCollection(dataSourceDoc) {
  let client = mongoClients.get(dataSourceDoc.connectionUrl);
  if (!client) {
    client = new MongoClient(dataSourceDoc.connectionUrl);
    await client.connect();
    mongoClients.set(dataSourceDoc.connectionUrl, client);
  }
  return client.db(dataSourceDoc.dbName).collection(dataSourceDoc.collectionName);
}

function getPgPool(dataSourceDoc) {
  let pool = pgPools.get(dataSourceDoc.connectionUrl);
  if (!pool) {
    pool = new Pool({ connectionString: dataSourceDoc.connectionUrl });
    pgPools.set(dataSourceDoc.connectionUrl, pool);
  }
  return pool;
}

// Postgres needs columns to exist before you can write to them — Mongo
// doesn't (setting a field that doesn't exist yet just creates it), so
// this is a no-op there. Uses "IF NOT EXISTS" so it's always safe to call.
async function ensurePostgresColumns(pool, tableName, columns) {
  for (const [colName, colType] of columns) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${colName} ${colType}`);
  }
}

// Finds a record in the external source matching a ticketId or a manual
// search value (mapped email/phone), scoped to this data source only.
async function findExternalRecord(dataSourceDoc, { ticketIdValue, manualValue }) {
  const names = dataSourceDoc.externalFieldNames;
  const fm = dataSourceDoc.fieldMap || {};

  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    const query = ticketIdValue
      ? { [names.ticketId]: ticketIdValue }
      : {
          $or: [
            fm.email ? { [fm.email]: manualValue } : null,
            fm.phone ? { [fm.phone]: manualValue } : null,
            { [names.ticketId]: manualValue },
          ].filter(Boolean),
        };
    return collection.findOne(query);
  }

  if (dataSourceDoc.type === "postgres") {
    const pool = getPgPool(dataSourceDoc);
    if (ticketIdValue) {
      const result = await pool.query(`SELECT * FROM ${dataSourceDoc.tableName} WHERE ${names.ticketId} = $1 LIMIT 1`, [
        ticketIdValue,
      ]);
      return result.rows[0] || null;
    }
    const clauses = [];
    const params = [];
    if (fm.email) {
      clauses.push(`${fm.email} = $${params.length + 1}`);
      params.push(manualValue);
    }
    if (fm.phone) {
      clauses.push(`${fm.phone} = $${params.length + 1}`);
      params.push(manualValue);
    }
    clauses.push(`${names.ticketId} = $${params.length + 1}`);
    params.push(manualValue);

    const result = await pool.query(
      `SELECT * FROM ${dataSourceDoc.tableName} WHERE ${clauses.join(" OR ")} LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  }

  throw new Error(`Unsupported type: ${dataSourceDoc.type}`);
}

// Ensures a record has a ticketId + qrToken, generating and writing them
// back into the external source (creating the fields/columns first if
// they don't exist) if it doesn't have them yet.
async function ensureExternalTicket(dataSourceDoc, record, recordKey) {
  const names = dataSourceDoc.externalFieldNames;

  if (record[names.ticketId]) {
    return { ticketId: record[names.ticketId], qrToken: record[names.qrToken] };
  }

  const ticketId = generateTicketId("EXT"); // event code isn't always meaningful here; kept generic
  const token = qrToken.sign(ticketId, String(dataSourceDoc.eventId));

  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    await collection.updateOne({ _id: recordKey }, { $set: { [names.ticketId]: ticketId, [names.qrToken]: token } });
  } else {
    const pool = getPgPool(dataSourceDoc);
    await ensurePostgresColumns(pool, dataSourceDoc.tableName, [
      [names.ticketId, "TEXT"],
      [names.qrToken, "TEXT"],
    ]);
    await pool.query(`UPDATE ${dataSourceDoc.tableName} SET ${names.ticketId} = $1, ${names.qrToken} = $2 WHERE ${recordKey.column} = $3`, [
      ticketId,
      token,
      recordKey.value,
    ]);
  }

  return { ticketId, qrToken: token };
}

// Marks a record as checked in directly in the external source, creating
// the checkedIn/checkedInAt field/column first if it doesn't exist.
async function markExternalCheckedIn(dataSourceDoc, record, recordKey) {
  const names = dataSourceDoc.externalFieldNames;

  if (record[names.checkedIn]) {
    return { alreadyCheckedIn: true, checkedInAt: record[names.checkedInAt] };
  }

  const now = new Date();

  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    const result = await collection.updateOne(
      { _id: recordKey, [names.checkedIn]: { $ne: true } }, // atomic — same duplicate-check-in protection as our own DB
      { $set: { [names.checkedIn]: true, [names.checkedInAt]: now } }
    );
    if (result.modifiedCount === 0) {
      const fresh = await collection.findOne({ _id: recordKey });
      return { alreadyCheckedIn: true, checkedInAt: fresh?.[names.checkedInAt] };
    }
  } else {
    const pool = getPgPool(dataSourceDoc);
    await ensurePostgresColumns(pool, dataSourceDoc.tableName, [
      [names.checkedIn, "BOOLEAN DEFAULT FALSE"],
      [names.checkedInAt, "TIMESTAMP"],
    ]);
    // atomic — only updates if not already checked in, same guarantee as Mongo above
    const result = await pool.query(
      `UPDATE ${dataSourceDoc.tableName} SET ${names.checkedIn} = TRUE, ${names.checkedInAt} = $1 WHERE ${recordKey.column} = $2 AND (${names.checkedIn} IS NOT TRUE) RETURNING *`,
      [now, recordKey.value]
    );
    if (result.rowCount === 0) {
      const existing = await pool.query(`SELECT ${names.checkedInAt} FROM ${dataSourceDoc.tableName} WHERE ${recordKey.column} = $1`, [
        recordKey.value,
      ]);
      return { alreadyCheckedIn: true, checkedInAt: existing.rows[0]?.[names.checkedInAt] };
    }
  }

  return { alreadyCheckedIn: false, checkedInAt: now };
}

// Reads every record from the external source, mapped into a display
// shape the Registrations tab can render the same way regardless of
// where the data actually lives.
async function readAllExternal(dataSourceDoc) {
  const names = dataSourceDoc.externalFieldNames;
  const fm = dataSourceDoc.fieldMap || {};

  let rawRows;
  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    rawRows = await collection.find({}).toArray();
  } else {
    const pool = getPgPool(dataSourceDoc);
    const result = await pool.query(`SELECT * FROM ${dataSourceDoc.tableName}`);
    rawRows = result.rows;
  }

  return rawRows.map((row) => {
    const recordId =
      dataSourceDoc.type === "mongodb" ? String(row._id) : String(row[names.primaryKeyColumn]);

    const customFields = {};
    for (const [ourField, externalField] of Object.entries(fm)) {
      if (externalField && row[externalField] !== undefined) customFields[ourField] = row[externalField];
    }

    return {
      recordId,
      customFields,
      ticketId: row[names.ticketId] || null,
      checkedIn: !!row[names.checkedIn],
      checkedInAt: row[names.checkedInAt] || null,
      createdAt: row.createdAt || row.created_at || null,
      _source: "external",
    };
  });
}

async function updateExternalRecord(dataSourceDoc, recordId, customFieldUpdates) {
  const fm = dataSourceDoc.fieldMap || {};
  const names = dataSourceDoc.externalFieldNames;

  // translate our field names back to their column/field names
  const externalUpdates = {};
  for (const [ourField, value] of Object.entries(customFieldUpdates || {})) {
    const externalField = fm[ourField];
    if (externalField) externalUpdates[externalField] = value;
  }
  if (Object.keys(externalUpdates).length === 0) return;

  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    await collection.updateOne({ _id: new ObjectId(recordId) }, { $set: externalUpdates });
  } else {
    const pool = getPgPool(dataSourceDoc);
    const setClauses = Object.keys(externalUpdates).map((col, i) => `${col} = $${i + 1}`);
    const values = Object.values(externalUpdates);
    values.push(recordId);
    await pool.query(
      `UPDATE ${dataSourceDoc.tableName} SET ${setClauses.join(", ")} WHERE ${names.primaryKeyColumn} = $${values.length}`,
      values
    );
  }
}

async function deleteExternalRecord(dataSourceDoc, recordId) {
  const names = dataSourceDoc.externalFieldNames;
  if (dataSourceDoc.type === "mongodb") {
    const collection = await getMongoCollection(dataSourceDoc);
    await collection.deleteOne({ _id: new ObjectId(recordId) });
  } else {
    const pool = getPgPool(dataSourceDoc);
    await pool.query(`DELETE FROM ${dataSourceDoc.tableName} WHERE ${names.primaryKeyColumn} = $1`, [recordId]);
  }
}

module.exports = {
  findExternalRecord,
  ensureExternalTicket,
  markExternalCheckedIn,
  readAllExternal,
  updateExternalRecord,
  deleteExternalRecord,
};