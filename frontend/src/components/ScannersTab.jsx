import { useEffect, useState } from "react";
import client from "../api/client";
import { Badge, EmptyState, Spinner } from "./ui";

export default function ScannersTab({ eventId }) {
  const [scanners, setScanners] = useState(null);
  const [gates, setGates] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ userId: "", gateId: "", deviceName: "" });

  const load = () => client.get(`/api/events/${eventId}/scanners`).then(({ data }) => setScanners(data.data));

  useEffect(() => {
    load();
    client.get(`/api/events/${eventId}/gates`).then(({ data }) => setGates(data.data));
    client
      .get("/api/users")
      .then(({ data }) => setUsers(data.data.filter((u) => u.role === "SCANNER")))
      .catch(() => setUsers([])); // non-Super-Admin can't list all users — fine, just skip
  }, [eventId]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.userId || !form.gateId) return;
    await client.post(`/api/events/${eventId}/scanners`, form);
    setForm({ userId: "", gateId: "", deviceName: "" });
    load();
  };

  const revoke = async (id) => {
    await client.post(`/api/events/${eventId}/scanners/${id}/revoke`);
    load();
  };

  return (
    <div>
      <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 max-w-2xl">
        <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} className="input">
          <option value="">Scanner user…</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={form.gateId} onChange={(e) => setForm((f) => ({ ...f, gateId: e.target.value }))} className="input">
          <option value="">Gate…</option>
          {gates.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          value={form.deviceName}
          onChange={(e) => setForm((f) => ({ ...f, deviceName: e.target.value }))}
          placeholder="Device name (optional)"
          className="input"
        />
        <button className="bg-primary hover:bg-primary-dark text-white text-sm rounded-lg">Assign</button>
      </form>

      {!scanners ? (
        <Spinner />
      ) : scanners.length === 0 ? (
        <EmptyState message="No scanners assigned yet." />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Gate</th>
                <th className="text-left px-4 py-3">Device</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {scanners.map((s) => (
                <tr key={s._id} className="border-t border-border">
                  <td className="px-4 py-3">{s.userId?.name}</td>
                  <td className="px-4 py-3">{s.gateId?.name}</td>
                  <td className="px-4 py-3 text-muted">{s.deviceName || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "ACTIVE" && (
                      <button onClick={() => revoke(s._id)} className="text-danger text-xs hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
