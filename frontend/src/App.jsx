import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventCreate from "./pages/EventCreate";
import EventDetail from "./pages/EventDetail";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import PublicEventPage from "./pages/PublicEventPage";
import RegisterPage from "./pages/RegisterPage";
import TicketPage from "./pages/TicketPage";
import Scanner from "./pages/Scanner";

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin/events" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* public */}
      <Route path="/events/:slug" element={<PublicEventPage />} />
      <Route path="/events/:slug/register" element={<RegisterPage />} />
      <Route path="/ticket/:ticketId" element={<TicketPage />} />

      {/* admin */}
      <Route
        path="/admin"
        element={
          <RequireAuth roles={["SUPER_ADMIN"]}>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/events"
        element={
          <RequireAuth>
            <Events />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/events/new"
        element={
          <RequireAuth roles={["SUPER_ADMIN"]}>
            <EventCreate />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/events/:id"
        element={
          <RequireAuth roles={["SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER", "REGISTRATION_MANAGER"]}>
            <EventDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth roles={["SUPER_ADMIN"]}>
            <Users />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAuth roles={["SUPER_ADMIN"]}>
            <AuditLogs />
          </RequireAuth>
        }
      />

      {/* scanner */}
      <Route
        path="/scanner/:eventId"
        element={
          <RequireAuth roles={["SUPER_ADMIN", "EVENT_ADMIN", "GATE_MANAGER", "SCANNER"]}>
            <Scanner />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/admin/events" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}