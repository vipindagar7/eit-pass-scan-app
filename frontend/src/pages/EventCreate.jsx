import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";

const EVENT_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
];

export default function EventCreate() {
  const [form, setForm] = useState({
    eventCode: "",
    name: "",
    description: "",
    venue: "",
    uniqueField: "email",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { data } = await client.post("/api/events", form);
      navigate(`/admin/events/${data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="text-xl font-bold mb-6">New event</h1>

      <form onSubmit={handleSubmit} className="max-w-lg bg-surface border border-border rounded-xl p-6 space-y-4">
        <Field label="Event code (unique, uppercase)">
          <input
            value={form.eventCode}
            onChange={(e) => set("eventCode", e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required className="input" />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="input"
          />
        </Field>
        <Field label="Venue">
          <input value={form.venue} onChange={(e) => set("venue", e.target.value)} className="input" />
        </Field>
        <Field label="Unique field for duplicate-registration checks">
          <input
            value={form.uniqueField}
            onChange={(e) => set("uniqueField", e.target.value)}
            placeholder="e.g. email, phone, studentId — must match a form field's name"
            className="input"
          />
        </Field>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm"
        >
          {saving ? "Creating…" : "Create event"}
        </button>
      </form>
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
