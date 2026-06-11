import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await login(password);
    setLoading(false);
    if (ok) navigate("/");
    else setError("Incorrect password. Try again.");
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "var(--bg)",
    }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: "var(--purple-light)",
            borderRadius: 14, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
          }}>
            <i className="ti ti-robot" style={{ fontSize: 24, color: "var(--purple-dark)" }} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>BotDeck</h1>
          <p style={{ color: "var(--text3)", marginTop: 4, fontSize: 13 }}>
            Sign in to manage your bots
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your dashboard password"
              autoFocus
              required
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button type="submit" className="primary" disabled={loading} style={{ justifyContent: "center", padding: "9px 0" }}>
            {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
