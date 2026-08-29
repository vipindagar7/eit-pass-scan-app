const mongoose = require("mongoose");

const dataSourceSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["mongodb", "postgres"], required: true },

    connectionUrl: { type: String, required: true, trim: true },

    // MongoDB: dbName + collectionName. Postgres: tableName only (schema
    // can be included in tableName, e.g. "public.registrations").
    dbName: { type: String, trim: true },
    collectionName: { type: String, trim: true },
    tableName: { type: String, trim: true },

    // maps THIS event's dynamic form field names to the column/field
    // names in the external source, e.g. { name: "full_name", email: "email_address" }
    fieldMap: { type: mongoose.Schema.Types.Mixed, default: {} },

    // "import" (default) — data gets copied into our own Registration/Ticket
    // collections, same as before.
    // "external" — nothing gets copied. The external database IS the
    // storage. We only ever write ticketId/qrToken (once, if missing) and
    // checkedIn/checkedInAt (on scan) directly into their own table/collection
    // — creating those columns/fields first if they don't already exist.
    storageMode: { type: String, enum: ["import", "external"], default: "import" },

    // column/field names to use when writing ticket + check-in data back
    // into the external source (only relevant when storageMode is "external")
    externalFieldNames: {
      ticketId: { type: String, default: "ticketId" },
      qrToken: { type: String, default: "qrToken" },
      checkedIn: { type: String, default: "checkedIn" },
      checkedInAt: { type: String, default: "checkedInAt" },
      checkedOutAt: { type: String, default: "checkedOutAt" },
      // Postgres only — the column used to identify a specific row for
      // updates (e.g. "id"). MongoDB always uses its own _id instead.
      primaryKeyColumn: { type: String, default: "id" },
    },

    lastImportedAt: { type: Date },
    lastImportSummary: { type: mongoose.Schema.Types.Mixed, default: null },

    // MongoDB: true Change Streams (needs the source to be a replica set).
    // Postgres: frequent polling fallback (true native push isn't
    // possible without the external DB owner setting up their own
    // triggers/LISTEN-NOTIFY, which we don't control).
    liveSyncEnabled: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DataSource", dataSourceSchema);