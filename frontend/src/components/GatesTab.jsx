import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import client from "../api/client";
import { EmptyState, Spinner } from "./ui";

export default function GatesTab({ eventId }) {
  const [gates, setGates] = useState(null);
  const [name, setName] = useState("");

  const load = () => client.get(`/api/events/${eventId}/gates`).then(({ data }) => setGates(data.data));

  useEffect(() => {
    load();
  }, [eventId]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await client.post(`/api/events/${eventId}/gates`, { name });
    setName("");
    load();
  };

  const remove = async (id) => {
    await client.delete(`/api/events/${eventId}/gates/${id}`);
    load();
  };

  return (
    <div>
      <form onSubmit={create} className="flex gap-2 mb-4 max-w-sm">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gate name" className="input" />
        <button className="bg-primary hover:bg-primary-dark text-white px-4 rounded-lg text-sm shrink-0">
          <Plus size={16} />
        </button>
      </form>

      {!gates ? (
        <Spinner />
      ) : gates.length === 0 ? (
        <EmptyState message="No gates yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {gates.map((gate) => (
            <div key={gate._id} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm font-medium">{gate.name}</span>
              <button onClick={() => remove(gate._id)} className="text-danger hover:bg-danger/20 p-1.5 rounded">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
