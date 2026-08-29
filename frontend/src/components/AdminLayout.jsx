import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, ScrollText, LogOut, Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNavClick = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-bg text-text md:flex">
      {/* mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border sticky top-0 bg-bg z-30">
        <div>
          <p className="font-bold text-sm">Event Platform</p>
          <p className="text-[10px] text-muted">{user?.role?.replace("_", " ")}</p>
        </div>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-2 rounded-lg bg-surface border border-border"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* mobile menu overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* sidebar — slide-in drawer on mobile, static on desktop */}
      <aside
        className={`fixed md:static top-0 left-0 h-full md:h-auto w-64 md:w-56 shrink-0 border-r border-border bg-surface flex flex-col z-50 transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-5 border-b border-border hidden md:block">
          <p className="font-bold text-lg">Event Platform</p>
          <p className="text-xs text-muted mt-1">{user?.role?.replace("_", " ")}</p>
        </div>
        <div className="p-4 border-b border-border flex items-center justify-between md:hidden">
          <p className="font-semibold text-sm">Menu</p>
          <button onClick={() => setMenuOpen(false)} className="p-1">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              onClick={handleNavClick}
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

      <main className="flex-1 p-4 md:p-6 overflow-auto min-w-0">{children}</main>
    </div>
  );
}