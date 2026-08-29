import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Copy, ScanLine } from "lucide-react";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";
import { Badge, Spinner, EmptyState } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function Events() {
  const [events, setEvents] = useState(null);
  const { user } = useAuth();

  const load = () => client.get("/api/events").then(({ data }) => setEvents(data.data));

  useEffect(() => {
    load();
  }, []);

  const duplicate = async (id) => {
    await client.post(`/api/events/${id}/duplicate`);
    load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Events</h1>
        {user?.role === "SUPER_ADMIN" && (
          <Link
            to="/admin/events/new"
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Plus size={16} /> New event
          </Link>
        )}
      </div>

      {!events ? (
        <Spinner />
      ) : events.length === 0 ? (
        <EmptyState message="No events yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div key={event._id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold">{event.name}</p>
                <Badge>{event.status}</Badge>
              </div>
              <p className="text-xs text-muted mb-4">{event.eventCode}</p>
              <div className="flex gap-2">
                <Link
                  to={`/admin/events/${event._id}`}
                  className="flex-1 text-center text-sm bg-white/5 hover:bg-white/10 rounded-lg py-2"
                >
                  Manage
                </Link>
                <Link
                  to={`/scanner/${event._id}`}
                  title="Open scanner"
                  className="px-3 bg-primary hover:bg-primary-dark text-white rounded-lg flex items-center"
                >
                  <ScanLine size={16} />
                </Link>
                {user?.role === "SUPER_ADMIN" && (
                  <button
                    onClick={() => duplicate(event._id)}
                    title="Duplicate"
                    className="px-3 bg-white/5 hover:bg-white/10 rounded-lg"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}