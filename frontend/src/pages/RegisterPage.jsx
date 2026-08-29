import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { Spinner } from "../components/ui";

export default function RegisterPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    client.get(`/api/events/public/${slug}`).then(({ data }) => {
      setEvent(data.data);
      client.get(`/api/events/${data.data._id}/form`).then(({ data: formData }) => {
        setFields((formData.data.fields || []).sort((a, b) => a.order - b.order));
      });
    });
  }, [slug]);

  const setValue = (name, val) => setValues((v) => ({ ...v, [name]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await client.post(`/api/events/${event._id}/register`, values);
      navigate(`/ticket/${data.data.ticketId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-1">Register</h1>
        <p className="text-muted mb-8">{event.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="text-sm block mb-1.5">
                {field.label}
                {field.required && <span className="text-danger"> *</span>}
              </label>
              <DynamicInput field={field} value={values[field.name]} onChange={(v) => setValue(field.name, v)} />
              {field.helpText && <p className="text-xs text-muted mt-1">{field.helpText}</p>}
            </div>
          ))}

          {error && <p className="text-danger text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-lg py-3 text-sm mt-2"
          >
            {submitting ? "Submitting…" : "Submit registration"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DynamicInput({ field, value, onChange }) {
  const common = { className: "input", required: field.required };

  switch (field.type) {
    case "TEXTAREA":
      return <textarea {...common} rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "SELECT":
      return (
        <select {...common} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "RADIO":
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type="radio" name={field.name} checked={value === opt} onChange={() => onChange(opt)} />
              {opt}
            </label>
          ))}
        </div>
      );
    case "CHECKBOX":
    case "MULTI_SELECT":
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options || []).map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={arr.includes(opt)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...arr, opt] : arr.filter((v) => v !== opt))
                  }
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    case "NUMBER":
      return <input {...common} type="number" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "DATE":
      return <input {...common} type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "EMAIL":
      return <input {...common} type="email" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "PHONE":
      return <input {...common} type="tel" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "URL":
      return <input {...common} type="url" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "FILE":
      return <input {...common} type="file" onChange={(e) => onChange(e.target.files[0]?.name || "")} />;
    default:
      return <input {...common} type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
}
