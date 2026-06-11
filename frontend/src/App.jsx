import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth.jsx";
import { ThemeProvider, useTheme } from "./hooks/useTheme.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Bots from "./pages/Bots.jsx";
import Tokens from "./pages/Tokens.jsx";
import Logs from "./pages/Logs.jsx";
import Behaviours from "./pages/Behaviours.jsx";
import Cron from "./pages/Cron.jsx";

function TopBar() {
  const { theme, toggle } = useTheme();
  return (
    <div style={{
      height: 44, borderBottom: "0.5px solid var(--border)",
      background: "var(--surface)", display: "flex",
      alignItems: "center", justifyContent: "flex-end",
      padding: "0 20px", gap: 8, flexShrink: 0,
    }}>
      <button
        onClick={toggle}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        style={{ border: "none", background: "transparent", color: "var(--text3)", padding: "4px 8px", fontSize: 18 }}
      >
        <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} aria-hidden="true" />
      </button>
    </div>
  );
}

function Layout() {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PrivateRoute() {
  const { authenticated } = useAuth();
  if (authenticated === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }
  return authenticated ? <Layout /> : <Navigate to="/login" replace />;
}

function PublicRoute() {
  const { authenticated } = useAuth();
  if (authenticated === null) return null;
  return authenticated ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bots" element={<Bots />} />
            <Route path="/tokens" element={<Tokens />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/behaviours" element={<Behaviours />} />
            <Route path="/cron" element={<Cron />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
