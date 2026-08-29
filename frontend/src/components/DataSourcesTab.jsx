import { useEffect, useState } from "react";
import { Plus, Radio, Search, Pencil, Trash2 } from "lucide-react";
import client from "../api/client";
import { Spinner, EmptyState } from "./ui";

const EMPTY_FORM = {
  name: "",
  type: "mongodb",
  connectionUrl: "",
  dbName: "",
  collectionName: "",
  tableName: "",
  storageMode: "import",
  primaryKeyColumn: "id",
};

export default function DataSourcesTab({ eventId }) {
  const [sources, setSources] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // data source _id being edited, or null for "create new"
  const [toggling, setToggling] = useState(null);
  const [ourFields, setOurFields] = useState([]); // this event's own form fields, to map FROM
  const [detectedFields, setDetectedFields] = useState(null); // external field names, once detected
  const [detecting, setDetecting] = useState(false);
  const [fieldMap, setFieldMap] = useState({}); // { ourFieldName: externalFieldName }
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const load = () => client.get(`/api/events/${eventId}/data-sources`).then(({ data }) => setSources(data.data));

  useEffect(() => {
    load();
    client.get(`/api/events/${eventId}/form`).then(({ data }) => {
      const fields = (data.data.fields || []).map((f) => f.name);
      setOurFields(["name", "email", "phone", ...fields.filter((f) => !["name", "email", "phone"].includes(f))]);
    });
  }, [eventId]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setDetectedFields(null);
    setFieldMap({});
    setForm(EMPTY_FORM);
    setError("");
  };

  const startCreate = () => {
    closeForm();
    setShowForm(true);
  };

  const startEdit = (source) => {
    setEditingId(source._id);
    setShowForm(true);
    setDetectedFields(null);
    setFieldMap(source.fieldMap || {});
    setForm({
      ...EMPTY_FORM,
      name: source.name,
      type: source.type,
      dbName: source.dbName || "",
      collectionName: source.collectionName || "",
      tableName: source.tableName || "",
      storageMode: source.storageMode,
      primaryKeyColumn: source.externalFieldNames?.primaryKeyColumn || "id",
      connectionUrl: "", // not returned by the API for security — re-enter to re-detect fields
    });
  };

  const detectFields = async () => {
    setError("");
    setDetecting(true);
    try {
      const { data } = await client.post(`/api/events/${eventId}/data-sources/preview`, {
        type: form.type,
        connectionUrl: form.connectionUrl,
        dbName: form.dbName,
        collectionName: form.collectionName,
        tableName: form.tableName,
      });
      setDetectedFields(data.data.fields);
      if (data.data.fields.length === 0) {
        setError(data.data.note || "Connected, but no fields found.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't connect to detect fields");
      setDetectedFields(null);
    } finally {
      setDetecting(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");

    // only keep mappings the admin actually set
    const cleanFieldMap = Object.fromEntries(Object.entries(fieldMap).filter(([, v]) => v));

    try {
      if (editingId) {
        // editing an existing source — only field mapping (and name) are
        // meant to change here; connection details stay as originally set
        // unless re-entered above to re-detect
        const payload = { name: form.name, fieldMap: cleanFieldMap };
        if (form.connectionUrl) payload.connectionUrl = form.connectionUrl; // only update if re-entered
        await client.patch(`/api/events/${eventId}/data-sources/${editingId}`, payload);
      } else {
        await client.post(`/api/events/${eventId}/data-sources`, {
          ...form,
          fieldMap: cleanFieldMap,
          externalFieldNames: form.storageMode === "external" ? { primaryKeyColumn: form.primaryKeyColumn } : undefined,
        });
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save data source");
    }
  };

  const toggleLiveSync = async (source) => {
    setToggling(source._id);
    try {
      const { data } = await client.post(`/api/events/${eventId}/data-sources/${source._id}/live-sync`, {
        enabled: !source.liveSyncEnabled,
      });
      if (data.data.backlogImport) {
        const s = data.data.backlogImport;
        alert(`Live sync enabled. Backlog caught up: ${s.imported} imported, ${s.skipped} skipped, ${s.failed} failed.`);
      }
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't toggle live sync");
    } finally {
      setToggling(null);
    }
  };

  const deleteSource = async (source) => {
    if (!confirm(`Delete "${source.name}"? If it's in Import mode, data already copied into this platform stays — only the connection config is removed.`)) return;
    try {
      await client.delete(`/api/events/${eventId}/data-sources/${source._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't delete data source");
    }
  };

  const canDetect =
    form.connectionUrl && (form.type === "mongodb" ? form.dbName && form.collectionName : form.tableName);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted max-w-md">
          Connect another system's database. Turning live sync on immediately catches up on everything already
          there, then keeps pulling new registrations in as they appear — no manual import step needed.
        </p>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-sm px-3 py-2 rounded-lg shrink-0"
        >
          <Plus size={16} /> Add source
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <p className="text-sm font-medium">{editingId ? "Edit data source" : "New data source"}</p>

          <input placeholder="Name (e.g. Old Registration System)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />

          {!editingId && (
            <div>
              <label className="text-xs text-muted block mb-1">Storage mode</label>
              <select value={form.storageMode} onChange={(e) => setForm((f) => ({ ...f, storageMode: e.target.value }))} className="input">
                <option value="import">Import — copy their data into this platform</option>
                <option value="external">External — leave data in their database, just mark check-ins there</option>
              </select>
            </div>
          )}

          {!editingId && (
            <select
              value={form.type}
              onChange={(e) => {
                setForm((f) => ({ ...f, type: e.target.value }));
                setDetectedFields(null);
                setFieldMap({});
              }}
              className="input"
            >
              <option value="mongodb">MongoDB</option>
              <option value="postgres">Postgres</option>
            </select>
          )}

          <input
            placeholder={editingId ? "Connection URL (only needed if re-detecting fields)" : "Connection URL"}
            value={form.connectionUrl}
            onChange={(e) => {
              setForm((f) => ({ ...f, connectionUrl: e.target.value }));
              setDetectedFields(null);
            }}
            className="input"
            required={!editingId}
          />

          {!editingId &&
            (form.type === "mongodb" ? (
              <>
                <input placeholder="Database name" value={form.dbName} onChange={(e) => { setForm((f) => ({ ...f, dbName: e.target.value })); setDetectedFields(null); }} className="input" required />
                <input placeholder="Collection name" value={form.collectionName} onChange={(e) => { setForm((f) => ({ ...f, collectionName: e.target.value })); setDetectedFields(null); }} className="input" required />
                <p className="text-xs text-muted">
                  Live sync for MongoDB uses Change Streams (falls back to polling automatically if the source isn't
                  a replica set).
                </p>
              </>
            ) : (
              <>
                <input placeholder="Table name" value={form.tableName} onChange={(e) => { setForm((f) => ({ ...f, tableName: e.target.value })); setDetectedFields(null); }} className="input" required />
                <p className="text-xs text-muted">Live sync for Postgres polls every 10 seconds.</p>
              </>
            ))}

          {!editingId && form.type === "postgres" && form.storageMode === "external" && (
            <input
              placeholder="Primary key column (e.g. id)"
              value={form.primaryKeyColumn}
              onChange={(e) => setForm((f) => ({ ...f, primaryKeyColumn: e.target.value }))}
              className="input"
            />
          )}

          <button
            type="button"
            onClick={detectFields}
            disabled={!canDetect || detecting}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-sm px-3 py-2 rounded-lg w-full justify-center"
          >
            <Search size={14} /> {detecting ? "Connecting…" : "Detect fields"}
          </button>

          {editingId && !detectedFields && (
            <p className="text-xs text-muted">
              Current mapping: {Object.keys(fieldMap).length === 0 ? "none set" : Object.entries(fieldMap).map(([k, v]) => `${k} → ${v}`).join(", ")}.
              Enter the connection URL above and click "Detect fields" to change it.
            </p>
          )}

          {detectedFields && detectedFields.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-2">
                Found {detectedFields.length} fields — pick which one matches each of your fields (leave blank to skip):
              </p>
              <div className="space-y-2">
                {ourFields.map((ourField) => (
                  <div key={ourField} className="flex items-center gap-2">
                    <span className="text-xs w-24 shrink-0 text-muted">{ourField}</span>
                    <select
                      value={fieldMap[ourField] || ""}
                      onChange={(e) => setFieldMap((m) => ({ ...m, [ourField]: e.target.value }))}
                      className="input text-xs py-1.5"
                    >
                      <option value="">— skip —</option>
                      {detectedFields.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!editingId && form.storageMode === "external" && (
            <p className="text-xs text-muted">
              In external mode, ticket IDs and check-in status get written directly into their table/collection
              (creating those columns/fields automatically if they don't exist yet) — nothing is copied into this
              platform's own database.
            </p>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-2">
            <button className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
              Save
            </button>
            <button type="button" onClick={closeForm} className="bg-white/5 hover:bg-white/10 text-sm px-4 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!sources ? (
        <Spinner />
      ) : sources.length === 0 ? (
        <EmptyState message="No data sources configured." />
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s._id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm flex items-center gap-2">
                  {s.name}
                  {s.storageMode === "external" ? (
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">External storage</span>
                  ) : (
                    s.liveSyncEnabled && (
                      <span className="flex items-center gap-1 text-success text-xs">
                        <Radio size={12} className="animate-pulse" /> Live
                      </span>
                    )
                  )}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {s.type} {s.lastImportedAt && `· last caught up ${new Date(s.lastImportedAt).toLocaleString()}`}
                </p>
                {s.lastImportSummary && (
                  <p className="text-xs text-muted mt-1">
                    {s.lastImportSummary.imported} imported · {s.lastImportSummary.skipped} skipped ·{" "}
                    {s.lastImportSummary.failed} failed
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => startEdit(s)} title="Edit field mapping" className="p-2 hover:bg-white/10 rounded-lg">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteSource(s)} title="Delete" className="p-2 hover:bg-danger/20 text-danger rounded-lg">
                  <Trash2 size={14} />
                </button>
                {s.storageMode === "external" ? (
                  <p className="text-xs text-muted">Scanner reads/writes this source directly</p>
                ) : (
                  <button
                    onClick={() => toggleLiveSync(s)}
                    disabled={toggling === s._id}
                    className={`text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50 ${
                      s.liveSyncEnabled ? "bg-danger/20 text-danger hover:bg-danger/30" : "bg-primary hover:bg-primary-dark text-white"
                    }`}
                  >
                    {toggling === s._id ? "…" : s.liveSyncEnabled ? "Turn off" : "Turn on live sync"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}