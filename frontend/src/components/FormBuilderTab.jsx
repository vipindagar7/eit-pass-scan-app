import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import client from "../api/client";

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "RADIO",
  "CHECKBOX",
  "URL",
  "FILE",
];

export default function FormBuilderTab({ eventId }) {
  const [fields, setFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    client.get(`/api/events/${eventId}/form`).then(({ data }) => setFields(data.data.fields || []));
  }, [eventId]);

  const addField = () => {
    setFields((f) => [
      ...f,
      { label: "New field", name: `field_${Date.now()}`, type: "TEXT", required: false, options: [], order: f.length },
    ]);
  };

  const updateField = (index, updates) => {
    setFields((f) => f.map((field, i) => (i === index ? { ...field, ...updates } : field)));
  };

  const removeField = (index) => setFields((f) => f.filter((_, i) => i !== index));

  const move = (index, dir) => {
    setFields((f) => {
      const next = [...f];
      const target = index + dir;
      if (target < 0 || target >= next.length) return f;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await client.put(`/api/events/${eventId}/form`, { fields });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">Fields are shown to attendees in this order.</p>
        <button
          onClick={addField}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={16} /> Add field
        </button>
      </div>

      <div className="space-y-3">
        {fields.map((field, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Label</label>
                <input
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Field key (used in data)</label>
                <input
                  value={field.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Type</label>
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value })}
                  className="input"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {["SELECT", "MULTI_SELECT", "RADIO", "CHECKBOX"].includes(field.type) && (
                <div>
                  <label className="text-xs text-muted block mb-1">Options (comma-separated)</label>
                  <input
                    value={(field.options || []).join(", ")}
                    onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    className="input"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                />
                Required
              </label>

              <div className="flex gap-1">
                <button onClick={() => move(i, -1)} className="p-1.5 hover:bg-white/10 rounded" title="Move up">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => move(i, 1)} className="p-1.5 hover:bg-white/10 rounded" title="Move down">
                  <ChevronDown size={16} />
                </button>
                <button
                  onClick={() => removeField(i)}
                  className="p-1.5 hover:bg-danger/20 text-danger rounded"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save form"}
      </button>
    </div>
  );
}
