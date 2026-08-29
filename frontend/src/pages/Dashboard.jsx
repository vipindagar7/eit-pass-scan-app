import { useEffect, useState } from "react";
import client from "../api/client";
import AdminLayout from "../components/AdminLayout";
import { StatCard, Spinner } from "../components/ui";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get("/api/analytics/overview").then(({ data }) => setData(data.data));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      {!data ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Events" value={data.totalEvents} />
          <StatCard label="Active Events" value={data.activeEvents} />
          <StatCard label="Total Registrations" value={data.totalRegistrations} />
          <StatCard label="Total Checked In" value={data.totalCheckedIn} />
          <StatCard label="Total Users" value={data.totalUsers} />
          <StatCard label="Today's Check-ins" value={data.todaysCheckIns} />
        </div>
      )}
    </AdminLayout>
  );
}
