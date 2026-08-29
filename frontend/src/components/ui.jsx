export function StatCard({ label, value, sub }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

const badgeColors = {
  DRAFT: "bg-white/10 text-muted",
  PUBLISHED: "bg-primary/20 text-primary",
  REGISTRATION_OPEN: "bg-success/20 text-success",
  REGISTRATION_CLOSED: "bg-warn/20 text-warn",
  LIVE: "bg-success/20 text-success",
  COMPLETED: "bg-white/10 text-muted",
  ARCHIVED: "bg-white/10 text-muted",
  CANCELLED: "bg-danger/20 text-danger",
  ACTIVE: "bg-success/20 text-success",
  REVOKED: "bg-danger/20 text-danger",
  CONFIRMED: "bg-success/20 text-success",
  SENT: "bg-success/20 text-success",
  FAILED: "bg-danger/20 text-danger",
  PENDING: "bg-warn/20 text-warn",
};

export function Badge({ children }) {
  const cls = badgeColors[children] || "bg-white/10 text-muted";
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{children}</span>;
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-white/5 rounded ${className}`} />;
}

export function EmptyState({ message }) {
  return <p className="text-muted text-sm py-10 text-center">{message}</p>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
