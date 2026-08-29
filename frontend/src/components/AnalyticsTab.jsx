import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import client from "../api/client";
import { StatCard, Spinner } from "./ui";

export default function AnalyticsTab({ eventId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    client.get(`/api/events/${eventId}/analytics`).then(({ data }) => setData(data.data));
  }, [eventId]);

  if (!data) return <Spinner />;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Registrations" value={data.totalRegistrations} />
        <StatCard label="Checked In" value={data.totalCheckedIn} />
        <StatCard label="Not Checked In" value={data.notCheckedIn} />
        <StatCard label="Attendance Rate" value={`${data.attendanceRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Registrations over time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.registrationsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "#8b91a3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8b91a3" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#12151d", border: "1px solid #232733" }} />
              <Line type="monotone" dataKey="count" stroke="#5b8def" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Check-ins over time">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.checkInsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
              <XAxis dataKey="_id" tick={{ fontSize: 11, fill: "#8b91a3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8b91a3" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#12151d", border: "1px solid #232733" }} />
              <Line type="monotone" dataKey="count" stroke="#3cc882" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Gate-wise check-ins">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.checkInsByGate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
              <XAxis dataKey="gateName" tick={{ fontSize: 11, fill: "#8b91a3" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8b91a3" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#12151d", border: "1px solid #232733" }} />
              <Bar dataKey="count" fill="#5b8def" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-sm font-medium mb-2">{title}</p>
      {children}
    </div>
  );
}
