import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Mail } from "lucide-react";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";
import { Badge, Spinner } from "../components/ui";

const ROLES = ["SUPER_ADMIN", "EVENT_ADMIN", "REGISTRATION_MANAGER", "GATE_MANAGER", "SCANNER"];

export default function Users() {
  const [users, setUsers] = useState(null);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "SCANNER", assignedEvents: [] });
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // user being edited, or null
  const [editForm, setEditForm] = useState({ name: "", role: "", assignedEvents: [] });
  const [error, setError] = useState("");

  const load = () => client.get("/api/users").then(({ data }) => setUsers(data.data));

  useEffect(() => {
    load();
    client.get("/api/events").then(({ data }) => setEvents(data.data));
  }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await client.post("/api/users", form);
      setForm({ name: "", email: "", password: "", role: "SCANNER", assignedEvents: [] });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create user");
    }
  };

  const toggleDisabled = async (user) => {
    await client.patch(`/api/users/${user._id}`, { disabled: !user.disabled });
    load();
  };

  const deleteUser = async (user) => {
    if (!confirm(`Delete ${user.name}? This can't be undone.`)) return;
    await client.delete(`/api/users/${user._id}`);
    load();
  };

  const sendLoginEmail = async (user) => {
    if (!confirm(`Send ${user.name} a new login password + link by email? Their current password will stop working.`)) return;
    try {
      const { data } = await client.post(`/api/users/${user._id}/send-credentials`);
      alert(data.data.emailed ? "Sent." : "New password was set, but the email couldn't be sent (check SMTP config).");
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't send credentials");
    }
  };

  const toggleEvent = (eventId) => {
    setForm((f) => ({
      ...f,
      assignedEvents: f.assignedEvents.includes(eventId)
        ? f.assignedEvents.filter((id) => id !== eventId)
        : [...f.assignedEvents, eventId],
    }));
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      assignedEvents: (user.assignedEvents || []).map((e) => (typeof e === "string" ? e : e._id)),
    });
  };

  const toggleEditEvent = (eventId) => {
    setEditForm((f) => ({
      ...f,
      assignedEvents: f.assignedEvents.includes(eventId)
        ? f.assignedEvents.filter((id) => id !== eventId)
        : [...f.assignedEvents, eventId],
    }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    await client.patch(`/api/users/${editingUser._id}`, editForm);
    setEditingUser(null);
    load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Users</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> New user
        </button>
      </div>

      {showForm && (
        <form onSubmit={createUser} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" required />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input" required />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {form.role !== "SUPER_ADMIN" && (
            <div>
              <p className="text-xs text-muted mb-2">Assigned events</p>
              <div className="flex flex-wrap gap-2">
                {events.map((ev) => (
                  <label
                    key={ev._id}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                      form.assignedEvents.includes(ev._id) ? "bg-primary/20 border-primary" : "border-border"
                    }`}
                  >
                    <input type="checkbox" className="hidden" onChange={() => toggleEvent(ev._id)} />
                    {ev.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
          <button className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
            Create
          </button>
        </form>
      )}

      {editingUser && (
        <form onSubmit={saveEdit} className="bg-surface border border-border rounded-xl p-5 mb-6 max-w-lg space-y-3">
          <p className="text-sm font-medium mb-1">Edit {editingUser.name}</p>
          <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="input" required />
          <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {editForm.role !== "SUPER_ADMIN" && (
            <div>
              <p className="text-xs text-muted mb-2">Assigned events</p>
              <div className="flex flex-wrap gap-2">
                {events.map((ev) => (
                  <label
                    key={ev._id}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                      editForm.assignedEvents.includes(ev._id) ? "bg-primary/20 border-primary" : "border-border"
                    }`}
                  >
                    <input type="checkbox" className="hidden" onChange={() => toggleEditEvent(ev._id)} />
                    {ev.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg">
              Save
            </button>
            <button type="button" onClick={() => setEditingUser(null)} className="bg-white/5 hover:bg-white/10 text-sm px-4 py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {!users ? (
        <Spinner />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-muted text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-border">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">{u.role}</td>
                  <td className="px-4 py-3">
                    <Badge>{u.disabled ? "DISABLED" : "ACTIVE"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => startEdit(u)} title="Edit" className="p-1.5 hover:bg-white/10 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => sendLoginEmail(u)} title="Email login credentials" className="p-1.5 hover:bg-white/10 rounded">
                        <Mail size={14} />
                      </button>
                      <button onClick={() => toggleDisabled(u)} className="text-xs text-primary hover:underline px-1">
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                      <button onClick={() => deleteUser(u)} title="Delete" className="p-1.5 hover:bg-danger/20 text-danger rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}