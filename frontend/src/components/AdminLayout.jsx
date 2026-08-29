import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, ScrollText, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN"] },
  { to: "/admin/events", label: "Events", icon: CalendarDays, roles: null },
  { to: "/admin/users", label: "Users", icon: Users, roles: ["SUPER_ADMIN"] },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["SUPER_ADMIN"] },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-5 border-b border-border">
          <p className="font-bold text-lg">Event Platform</p>
          <p className="text-xs text-muted mt-1">{user?.role?.replace("_", " ")}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive ? "bg-primary text-white" : "text-muted hover:bg-white/5 hover:text-text"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:bg-white/5 hover:text-text w-full"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
