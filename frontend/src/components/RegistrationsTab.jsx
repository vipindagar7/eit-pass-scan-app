import { useEffect, useState } from "react";
import { Plus, Upload, Pencil, Trash2 } from "lucide-react";
import client from "../api/client";
import { Spinner, EmptyState, Badge } from "./ui";

export default function RegistrationsTab({ eventId }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState(null); // null | "individual" | "bulk"
  const [fields, setFields] = useState([]);
  const [individualValues, setIndividualValues] = useState({});
  const [csvText, setCsvText] = useState("");
  const [csvFieldMap, setCsvFieldMap] = useState("");
  const [formError, setFormError] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null); // record being edited, or null
  const [editValues, setEditValues] = useState({});

  const load = () =>
    client.get(`/api/events/${eventId}/registrations`, { params: { page, search } }).then(({ data }) => setData(data));

  useEffect(() => {
    load();
  }, [eventId, page, search]);

  useEffect(() => {
    client.get(`/api/events/${eventId}/form`).then(({ data }) => setFields(data.data.fields || []));
  }, [eventId]);

  const recordId = (r) => r._id || r.recordId;

  const submitIndividual = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await client.post(`/api/events/${eventId}/registrations/manual`, individualValues);
      setIndividualValues({});
      setMode(null);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || "Couldn't add registration");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    setFormError("");
    setBulkResult(null);
    let fieldMap = {};
    try {
      fieldMap = csvFieldMap.trim() ? JSON.parse(csvFieldMap) : {};
    } catch {
      setFormError('Field mapping must be valid JSON, e.g. {"name":"Full Name","email":"Email"}');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await client.post(`/api/events/${eventId}/registrations/bulk`, { csv: csvText, fieldMap });
      setBulkResult(data.data);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || "Bulk import failed");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (record) => {
    setEditingRecord(record);
    setEditValues({ ...record.customFields });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    await client.patch(`/api/events/${eventId}/registrations/${recordId(editingRecord)}`, { customFields: editValues });
    setEditingRecord(null);
    load();
  };

  const removeRecord = async (record) => {
    if (!confirm("Delete this registration? This can't be undone.")) return;
    await client.delete(`/api/events/${eventId}/registrations/${recordId(record)}`);
    load();
  };

  return (
    <div>
      {data?.source === "external" && (
        <p className="text-xs bg-white/5 border border-border rounded-lg px-3 py-2 mb-4">
          This event's registrations live in an external database — showing and editing them live from there.
        </p>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input max-w-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === "individual" ? null : "individual")}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-sm px-3 py-2 rounded-lg"
          >
            <Plus size={16} /> Add one
          </button>
          <button
            onClick={() => setMode(mode === "bulk" ? null : "bulk")}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-sm px-3 py-2 rounded-lg"
          >
            <Upload size={16} /> Bulk import
          </button>
        </div>
      </div>

      {mode === "individual" && (
        <form onSubmit={submitIndividual} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <p className="text-sm font-medium mb-1">Add a registration yourself</p>
          {fields.map((field) => (
            <div key={field.name}>
              <label className="text-xs text-muted block mb-1">{field.label}</label>
              <input
                value={individualValues[field.name] || ""}
                onChange={(e) => setIndividualValues((v) => ({ ...v, [field.name]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
          {formError && <p className="text-danger text-sm">{formError}</p>}
          <button disabled={submitting} className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {submitting ? "Adding…" : "Add registration"}
          </button>
        </form>
      )}

      {mode === "bulk" && (
        <form onSubmit={submitBulk} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <p className="text-sm font-medium mb-1">Bulk import from CSV</p>
          <div>
            <label className="text-xs text-muted block mb-1">Paste CSV text (with a header row)</label>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={5} className="input font-mono text-xs" required />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">
              Field mapping (JSON, optional — leave blank if your CSV column names already match this event's field names)
            </label>
            <textarea
              placeholder='{"name": "Full Name", "email": "Email"}'
              value={csvFieldMap}
              onChange={(e) => setCsvFieldMap(e.target.value)}
              rows={2}
              className="input font-mono text-xs"
            />
          </div>
          {formError && <p className="text-danger text-sm">{formError}</p>}
          {bulkResult && (
            <p className="text-sm text-success">
              {bulkResult.imported} imported · {bulkResult.skipped} skipped · {bulkResult.failed} failed (of{" "}
              {bulkResult.totalRows} rows)
            </p>
          )}
          <button disabled={submitting} className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {submitting ? "Importing…" : "Import"}
          </button>
        </form>
      )}

      {editingRecord && (
        <form onSubmit={saveEdit} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <p className="text-sm font-medium mb-1">Edit registration</p>
          {Object.keys(editingRecord.customFields || {}).map((key) => (
            <div key={key}>
              <label className="text-xs text-muted block mb-1">{key}</label>
              <input
                value={editValues[key] || ""}
                onChange={(e) => setEditValues((v) => ({ ...v, [key]: e.target.value }))}
                className="input"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
            <button type="button" onClick={() => setEditingRecord(null)} className="bg-white/5 hover:bg-white/10 text-sm px-4 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!data ? (
        <Spinner />
      ) : data.data.length === 0 ? (
        <EmptyState message="No registrations yet." />
      ) : (
        <>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Details</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={recordId(r)} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{r.registrationId || r.ticketId || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {Object.keys(r.customFields || {}).length === 0 ? (
                        <span className="text-muted">No details</span>
                      ) : (
                        <div className="space-y-0.5">
                          {Object.entries(r.customFields).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-muted">{k}:</span> {String(v)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{r.checkedIn !== undefined ? (r.checkedIn ? "CHECKED_IN" : "NOT_CHECKED_IN") : r.status || "CONFIRMED"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 hover:bg-white/10 rounded">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removeRecord(r)} title="Delete" className="p-1.5 hover:bg-danger/20 text-danger rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-muted">
            <span>
              Page {data.pagination.page} of {data.pagination.pages} ({data.pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg"
              >
                Prev
              </button>
              <button
                disabled={page >= data.pagination.pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}