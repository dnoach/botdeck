import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import styles from "./Sidebar.module.css";

const nav = [
  { to: "/", icon: "ti-layout-dashboard", label: "Dashboard" },
  { to: "/bots", icon: "ti-robot", label: "My bots" },
  { to: "/tokens", icon: "ti-chart-bar", label: "Token usage" },
];

const manage = [
  { to: "/logs", icon: "ti-messages", label: "Logs" },
  { to: "/behaviours", icon: "ti-adjustments", label: "Behaviours" },
  { to: "/cron", icon: "ti-clock-play", label: "Cron jobs" },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <i className="ti ti-robot" aria-hidden="true" />
        </div>
        <span>BotDeck</span>
      </div>

      <p className={styles.section}>Overview</p>
      {nav.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}
        >
          <i className={`ti ${item.icon}`} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}

      <p className={styles.section} style={{ marginTop: 16 }}>Manage</p>
      {manage.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ""}`}
        >
          <i className={`ti ${item.icon}`} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}

      <div className={styles.spacer} />
      <button className={styles.logoutBtn} onClick={toggle}>
        <i className={`ti ${theme === "dark" ? "ti-sun" : "ti-moon"}`} aria-hidden="true" />
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <button className={styles.logoutBtn} onClick={handleLogout}>
        <i className="ti ti-logout" aria-hidden="true" />
        Sign out
      </button>
    </aside>
  );
}
