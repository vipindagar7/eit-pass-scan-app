import { useEffect, useState } from "react";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";
import { Spinner, EmptyState } from "../components/ui";

export default function AuditLogs() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    client.get("/api/audit-logs", { params: { page } }).then(({ data }) => setData(data));
  }, [page]);

  return (
    <AdminLayout>
      <h1 className="text-xl font-bold mb-6">Audit logs</h1>

      {!data ? (
        <Spinner />
      ) : data.data.length === 0 ? (
        <EmptyState message="No activity logged yet." />
      ) : (
        <>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr key={log._id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-3">{log.userId?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted">{log.entity}</td>
                    <td className="px-4 py-3 text-muted text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-muted">
            <span>
              Page {data.pagination.page} of {data.pagination.pages}
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg">
                Prev
              </button>
              <button disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 rounded-lg">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
