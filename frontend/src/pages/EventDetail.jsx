import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";
import { Badge, Spinner } from "../components/ui";
import FormBuilderTab from "../components/FormBuilderTab";
import RegistrationsTab from "../components/RegistrationsTab";
import GatesTab from "../components/GatesTab";
import ScannersTab from "../components/ScannersTab";
import AnalyticsTab from "../components/AnalyticsTab";
import DataSourcesTab from "../components/DataSourcesTab";

const STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
];

const TABS = ["Overview", "Form Builder", "Registrations", "Data Sources", "Gates", "Scanners", "Analytics"];

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [tab, setTab] = useState("Overview");

  const load = () => client.get(`/api/events/${id}`).then(({ data }) => setEvent(data.data));

  useEffect(() => {
    load();
  }, [id]);

  const changeStatus = async (status) => {
    await client.patch(`/api/events/${id}/status`, { status });
    load();
  };

  if (!event) {
    return (
      <AdminLayout>
        <Spinner />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="text-sm text-muted mt-1">{event.eventCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/scanner/${id}`} className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
            Open scanner
          </Link>
          <Badge>{event.status}</Badge>
          <select
            value={event.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="input w-auto text-xs py-1.5"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 mt-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === t ? "border-primary text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="bg-surface border border-border rounded-xl p-5 max-w-lg space-y-2 text-sm">
          <Row label="Public page" value={`/events/${event.slug}`} link={`/events/${event.slug}`} />
          <Row label="Venue" value={event.venue || "—"} />
          <Row label="Unique field" value={event.uniqueField} />
          <Row label="Created" value={new Date(event.createdAt).toLocaleString()} />
        </div>
      )}
      {tab === "Form Builder" && <FormBuilderTab eventId={id} />}
      {tab === "Registrations" && <RegistrationsTab eventId={id} />}
      {tab === "Data Sources" && <DataSourcesTab eventId={id} />}
      {tab === "Gates" && <GatesTab eventId={id} />}
      {tab === "Scanners" && <ScannersTab eventId={id} />}
      {tab === "Analytics" && <AnalyticsTab eventId={id} />}
    </AdminLayout>
  );
}

function Row({ label, value, link }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {value}
        </a>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}