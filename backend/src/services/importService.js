const { MongoClient } = require("mongodb");
const { Pool } = require("pg");
const Event = require("../models/Event");
const EventForm = require("../models/EventForm");
const Registration = require("../models/Registration");
const Ticket = require("../models/Ticket");
const { generateRegistrationId, generateTicketId } = require("../utils/idGenerator");
const qrToken = require("../utils/qrToken");

// cached connections so repeated imports don't reconnect every time
const mongoClients = new Map();
const pgPools = new Map();

async function fetchExternalRows(dataSource) {
  if (dataSource.type === "mongodb") {
    let client = mongoClients.get(dataSource.connectionUrl);
    if (!client) {
      client = new MongoClient(dataSource.connectionUrl);
      await client.connect();
      mongoClients.set(dataSource.connectionUrl, client);
    }
    const db = client.db(dataSource.dbName);
    return db.collection(dataSource.collectionName).find({}).toArray();
  }

  if (dataSource.type === "postgres") {
    let pool = pgPools.get(dataSource.connectionUrl);
    if (!pool) {
      pool = new Pool({ connectionString: dataSource.connectionUrl });
      pgPools.set(dataSource.connectionUrl, pool);
    }
    const result = await pool.query(`SELECT * FROM ${dataSource.tableName}`);
    return result.rows;
  }

  throw new Error(`Unsupported data source type: ${dataSource.type}`);
}

// Maps one external row into this event's customFields shape, using the
// data source's configured fieldMap: { ourFieldName: externalColumnName }
function mapRow(row, fieldMap) {
  const mapped = {};
  for (const [ourField, externalField] of Object.entries(fieldMap)) {
    if (externalField && row[externalField] !== undefined) {
      mapped[ourField] = row[externalField];
    }
  }
  return mapped;
}

// Creates one registration + ticket directly (skips the "is registration
// open" check and the dynamic-form required-field validation that public
// submissions go through — imported/admin-entered data is trusted as
// already-valid by the person configuring the import).
async function createRegistrationDirect(event, customFields) {
  const uniqueFieldName = event.uniqueField || "email";
  const uniqueValue = customFields[uniqueFieldName];
  if (!uniqueValue) {
    return { skipped: true, reason: `Missing ${uniqueFieldName}` };
  }

  const existing = await Registration.findOne({
    eventId: event._id,
    uniqueValue: String(uniqueValue).toLowerCase().trim(),
  });
  if (existing) {
    return { skipped: true, reason: "Duplicate" };
  }

  const form = await EventForm.findOne({ eventId: event._id });

  const registration = await Registration.create({
    eventId: event._id,
    registrationId: generateRegistrationId(),
    customFields,
    formSnapshot: form?.fields || [],
    uniqueValue: String(uniqueValue).toLowerCase().trim(),
  });

  const ticketId = generateTicketId(event.eventCode);
  const token = qrToken.sign(ticketId, String(event._id));
  await Ticket.create({ eventId: event._id, registrationId: registration._id, ticketId, qrToken: token });

  return { skipped: false, registration };
}

// Runs a full import for a configured DataSource — returns a summary.
async function runImport(dataSourceDoc) {
  const event = await Event.findById(dataSourceDoc.eventId);
  if (!event) throw new Error("Event not found");

  const rows = await fetchExternalRows(dataSourceDoc);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const customFields = mapRow(row, dataSourceDoc.fieldMap || {});
      const result = await createRegistrationDirect(event, customFields);
      if (result.skipped) skipped++;
      else imported++;
    } catch (err) {
      failed++;
      errors.push(err.message);
    }
  }

  return { totalRows: rows.length, imported, skipped, failed, errors: errors.slice(0, 20) };
}

module.exports = { runImport, createRegistrationDirect, fetchExternalRows };