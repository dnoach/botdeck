import React, { useState, useEffect, useRef } from "react";
import ChatPanel from "../components/ChatPanel.jsx";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../hooks/api.js";

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height,
      borderRadius: radius,
      background: "linear-gradient(90deg, var(--surface2) 25%, var(--border2) 50%, var(--surface2) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

// inject shimmer keyframes once
if (typeof document !== "undefined" && !document.getElementById("shimmer-style")) {
  const s = document.createElement("style");
  s.id = "shimmer-style";
  s.textContent = `@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
  document.head.appendChild(s);
}

function AgentCardSkeleton() {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px" }}>
      <Skeleton width={140} height={140} radius={28} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton width="40%" height={18} />
        <Skeleton width="65%" height={13} />
        <Skeleton width={200} height={40} radius={4} />
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            <Skeleton width={32} height={20} />
            <Skeleton width={40} height={11} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Skeleton width="50%" height={12} />
      <Skeleton width="35%" height={28} />
      <Skeleton width="60%" height={11} />
    </div>
  );
}

// ── EKG Wave ──────────────────────────────────────────────────────────────────

function EkgWave({ color = "#1D9E75", width = 200, height = 40, bpm = 60 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const offsetRef = useRef(0);

  // bpm → speed: 60bpm = base, higher = faster
  const speed = (bpm / 60) * 0.006;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = width * dpr;
    const H = height * dpr;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    // Realistic EKG shape: P wave, QRS complex, T wave
    const ekgPoints = [
      [0.00, 0.50],
      [0.08, 0.50],
      [0.11, 0.38], // P wave start
      [0.14, 0.30], // P wave peak
      [0.17, 0.38], // P wave end
      [0.20, 0.50],
      [0.24, 0.50],
      [0.26, 0.55], // Q dip
      [0.28, 0.04], // R spike up
      [0.30, 0.92], // S spike down
      [0.32, 0.50], // return
      [0.35, 0.50],
      [0.37, 0.42], // T wave start
      [0.41, 0.28], // T wave peak
      [0.45, 0.42], // T wave end
      [0.50, 0.50],
      [1.00, 0.50],
    ];

    function getY(t) {
      const tp = t % 1;
      for (let j = 0; j < ekgPoints.length - 1; j++) {
        const [x0, y0] = ekgPoints[j];
        const [x1, y1] = ekgPoints[j + 1];
        if (tp >= x0 && tp <= x1) {
          const frac = (tp - x0) / (x1 - x0);
          return y0 + (y1 - y0) * frac;
        }
      }
      return 0.5;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Draw trailing glow line
      const steps = 240;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      for (let i = 1; i < steps; i++) {
        const t0 = (i - 1) / steps;
        const t1 = i / steps;
        const x0 = t0 * W;
        const x1 = t1 * W;
        const y0 = getY(t0 + offsetRef.current) * H;
        const y1 = getY(t1 + offsetRef.current) * H;

        // Fade at edges
        const alpha = i < 30 ? i / 30 : i > steps - 30 ? (steps - i) / 30 : 1;

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha * 0.85;
        ctx.lineWidth = 2.2 * dpr;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 * dpr;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Bright moving dot at the leading edge
      const dotT = offsetRef.current % 1;
      const dotX = ((1 - dotT) % 1) * W; // dot moves right to left as offset increases
      const dotY = getY(dotT + (1 - dotT)) * H;
      ctx.beginPath();
      ctx.arc(W * 0.85, getY(offsetRef.current + 0.85) * H, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * dpr;
      ctx.fill();
      ctx.shadowBlur = 0;

      offsetRef.current = (offsetRef.current + speed) % 1;
      animRef.current = requestAnimationFrame(draw);
    }

    const ctx = canvas.getContext("2d");
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [color, width, height, speed]);

  return <canvas ref={canvasRef} style={{ display: "block", borderRadius: 4 }} />;
}

// ── Agent Avatar ──────────────────────────────────────────────────────────────

function AgentAvatar({ agent, size = 140, radius = 28, fontSize = 70 }) {
  const [imgError, setImgError] = React.useState(false);
  const hasAvatar = agent.avatarPath && !imgError;
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: "var(--purple-light)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, flexShrink: 0, overflow: "hidden",
    }}>
      {hasAvatar ? (
        <img
          src={`/api/agents/${agent.id}/avatar`}
          alt={agent.identityName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgError(true)}
        />
      ) : agent.emoji}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 6 }}>
        <i className={`ti ${icon}`} style={{ color: color || "var(--text3)" }} aria-hidden="true" />
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 500 }}>{value ?? "—"}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text3)" }}>{sub}</p>}
    </div>
  );
}

function channelLabel(bindings) {
  if (!bindings?.length) return null;
  return bindings.map(b => `${b.channel} / ${b.accountId}`).join(", ");
}

// Calculate BPM from lastInteractionAt
// Recently active = fast pulse, idle = slow
function agentBpm(agent) {
  if (!agent.lastInteractionAt) return 30; // very slow — never seen
  const minsAgo = (Date.now() - agent.lastInteractionAt) / 1000 / 60;
  if (minsAgo < 5)   return 90; // very active
  if (minsAgo < 30)  return 72; // active
  if (minsAgo < 120) return 55; // somewhat idle
  if (minsAgo < 720) return 40; // idle
  return 28;                     // dormant
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [chatAgent, setChatAgent] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([apiFetch("/api/agents"), apiFetch("/api/usage")])
      .then(([a, u]) => {
        if (a?.ok) setAgents(a.data?.agents || []);
        else setError("Could not load agents.");
        if (u?.ok) setUsage(u.data);
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoading(false));
  }, []);

  const totalSessions = agents.reduce((s, a) => s + (a.activeSessionsCount || 0), 0);
  const totalCronEnabled = agents.reduce((s, a) => s + (a.enabledCronJobsCount || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        {error && <div className="error-banner">{error}</div>}

        {/* Stat cards — skeleton while loading */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {loading ? (
            [0,1,2,3].map(i => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard icon="ti-robot" label="Agents" color="var(--purple)"
                value={agents.length} sub={`${agents.filter(a => a.isDefault).length} default`} />
              <StatCard icon="ti-messages" label="Sessions" color="var(--green)"
                value={totalSessions} sub="across all agents" />
              <StatCard icon="ti-coin" label="Total cost" color="var(--amber)"
                value={usage?.totalCost ? `$${usage.totalCost.toFixed(2)}` : "$0"} sub="all time" />
              <StatCard icon="ti-clock-play" label="Active cron" color="var(--purple)"
                value={totalCronEnabled} sub="scheduled tasks" />
            </>
          )}
        </div>

        {/* Agent cards */}
        <div>
          <p style={{ fontWeight: 500, marginBottom: 12 }}>Agents</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              [0, 1].map(i => <AgentCardSkeleton key={i} />)
            ) : agents.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-robot-off" aria-hidden="true" />
                <p>No agents found. Check your OpenClaw config.</p>
              </div>
            ) : agents.map((agent) => {
              const bpm = agentBpm(agent);
              const lastSeen = agent.lastInteractionAt
                ? (() => {
                    const mins = Math.round((Date.now() - agent.lastInteractionAt) / 60000);
                    if (mins < 1) return "just now";
                    if (mins < 60) return `${mins}m ago`;
                    const hrs = Math.round(mins / 60);
                    if (hrs < 24) return `${hrs}h ago`;
                    return `${Math.round(hrs / 24)}d ago`;
                  })()
                : "never";

              return (
                <div key={agent.id} className="card" style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 18px",
                }}>
                  {/* Avatar */}
                  <AgentAvatar agent={agent} size={140} radius={28} fontSize={70} />

                  {/* Info + EKG */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontWeight: 500, fontSize: 15 }}>{agent.identityName}</span>
                      {agent.isDefault && (
                        <span className="tag" style={{ background: "var(--purple-light)", color: "var(--purple-dark)" }}>default</span>
                      )}
                      {agent.hasHeartbeat && (
                        <span className="tag" style={{ background: "var(--green-light)", color: "#0F6E56" }}>
                          <i className="ti ti-heartbeat" style={{ fontSize: 11 }} /> heartbeat
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>
                      {agent.vibe || channelLabel(agent.bindings) || agent.model}
                    </p>

                    {/* EKG + pulse info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <EkgWave color="#1D9E75" width={200} height={44} bpm={bpm} />
                      <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.6 }}>
                        <p style={{ fontWeight: 500, color: "var(--green)", fontSize: 12 }}>{bpm} BPM</p>
                        <p>last seen {lastSeen}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
                    <div>
                      <p style={{ fontWeight: 500, color: "var(--text)", fontSize: 16 }}>{agent.activeSessionsCount}</p>
                      <p>sessions</p>
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: "var(--text)", fontSize: 16 }}>{agent.enabledCronJobsCount}</p>
                      <p>cron</p>
                    </div>
                    <div>
                      <p style={{ fontWeight: 500, color: "var(--text)", fontSize: 16 }}>
                        {agent.usage?.totalTokens ? `${Math.round(agent.usage.totalTokens / 1000)}K` : "0"}
                      </p>
                      <p>tokens</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => navigate(`/behaviours?agent=${agent.id}`)} title="Edit behaviour">
                      <i className="ti ti-edit" aria-hidden="true" />
                    </button>
                    <button onClick={() => navigate(`/logs?agent=${agent.id}`)} title="View logs">
                      <i className="ti ti-messages" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {chatAgent && <ChatPanel agent={chatAgent} onClose={() => setChatAgent(null)} />}
    </>
  );
}
