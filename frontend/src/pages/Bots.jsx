import React, { useState, useEffect } from "react";
import ChatPanel from "../components/ChatPanel.jsx";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../hooks/api.js";

function AgentAvatar({ agent, size = 40, radius = 12, fontSize = 20 }) {
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
      ) : (
        agent.emoji
      )}
    </div>
  );
}

function channelLabel(bindings) {
  if (!bindings?.length) return "No channel binding";
  return bindings.map(b => `${b.channel} · ${b.accountId}`).join(", ");
}

function modelShort(model) {
  if (!model) return "—";
  return model.replace("openrouter/", "").replace("anthropic/", "").replace("openai/", "");
}

function BotCard({ agent, onSelect, onChat }) {
  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, cursor: "pointer", padding: "24px 20px 18px", textAlign: "center" }}
      onClick={() => onSelect(agent)}
    >
      {/* Hero avatar */}
      <div style={{ position: "relative" }}>
        <AgentAvatar agent={agent} size={140} radius={28} fontSize={70} />
        {/* Online dot */}
        <div style={{
          position: "absolute", bottom: 4, right: 4,
          width: 14, height: 14, borderRadius: "50%",
          background: "var(--green)",
          border: "2px solid var(--surface)",
        }} />
      </div>

      {/* Name + badges */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <p style={{ fontWeight: 600, fontSize: 17 }}>{agent.identityName}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {agent.isDefault && (
            <span className="tag" style={{ background: "var(--purple-light)", color: "var(--purple-dark)" }}>default</span>
          )}
          {agent.hasHeartbeat && (
            <span className="tag" style={{ background: "var(--green-light)", color: "#0F6E56" }}>
              <i className="ti ti-heartbeat" style={{ fontSize: 11 }} /> heartbeat
            </span>
          )}
        </div>
      </div>

      {/* Vibe */}
      <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.55, maxWidth: 200 }}>
        {agent.vibe || "No description set."}
      </p>

      {/* Tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <span className="tag">{modelShort(agent.model)}</span>
        {agent.bindings?.map((b, i) => (
          <span key={i} className="tag">
            <i className="ti ti-brand-telegram" style={{ fontSize: 11 }} /> {b.accountId}
          </span>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, borderTop: "0.5px solid var(--border)", paddingTop: 14, width: "100%" }}>
        {[
          { label: "Sessions", value: agent.activeSessionsCount },
          { label: "Cron", value: `${agent.enabledCronJobsCount}/${agent.cronJobsCount}` },
          { label: "Cost", value: agent.usage?.totalCost ? `$${agent.usage.totalCost.toFixed(3)}` : "$0" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 500, fontSize: 14 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "var(--text3)" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentDetail({ agent, onClose }) {
  const navigate = useNavigate();
  if (!agent) return null;

  const lastSeen = agent.lastInteractionAt
    ? new Date(agent.lastInteractionAt).toLocaleString()
    : "Never";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div
        className="card"
        style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <AgentAvatar agent={agent} size={96} radius={20} fontSize={48} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 500, fontSize: 16 }}>{agent.identityName}</p>
            <p style={{ fontSize: 12, color: "var(--text3)" }}>ID: {agent.id}</p>
          </div>
          <button onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></button>
        </div>

        {[
          { label: "Model", value: agent.model },
          { label: "Workspace", value: agent.workspace, mono: true },
          { label: "Last seen", value: lastSeen },
          { label: "Sessions", value: agent.activeSessionsCount },
          { label: "Cron jobs", value: `${agent.enabledCronJobsCount} enabled / ${agent.cronJobsCount} total` },
          { label: "Total cost", value: agent.usage?.totalCost ? `$${agent.usage.totalCost.toFixed(4)}` : "$0.0000" },
        ].map(row => (
          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid var(--border)", fontSize: 13 }}>
            <span style={{ color: "var(--text3)" }}>{row.label}</span>
            <span style={{ fontFamily: row.mono ? "monospace" : "inherit", fontSize: row.mono ? 11 : 13, color: "var(--text)", textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>
              {String(row.value)}
            </span>
          </div>
        ))}

        {agent.bindings?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)", marginBottom: 8 }}>CHANNEL BINDINGS</p>
            {agent.bindings.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 6 }}>
                <i className="ti ti-brand-telegram" style={{ color: "var(--purple)" }} aria-hidden="true" />
                <span>{b.channel}</span>
                <span className="tag">{b.accountId}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button style={{ flex: 1, justifyContent: "center" }} onClick={() => navigate(`/behaviours?agent=${agent.id}`)}>
            <i className="ti ti-edit" aria-hidden="true" /> Edit behaviour
          </button>
          <button style={{ flex: 1, justifyContent: "center" }} onClick={() => navigate(`/logs?agent=${agent.id}`)}>
            <i className="ti ti-messages" aria-hidden="true" /> View logs
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bots() {
  const [agents, setAgents] = useState([]);
  const [chatAgent, setChatAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiFetch("/api/agents")
      .then(r => {
        if (r?.ok) setAgents(r.data?.agents || []);
        else setError("Could not load agents.");
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter(a =>
    a.identityName?.toLowerCase().includes(search.toLowerCase()) ||
    a.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>My bots</h1>
          <p>{agents.length} agents configured</p>
        </div>
      </div>

      <div style={{ padding: "12px 20px 8px", borderBottom: "0.5px solid var(--border)", background: "var(--surface)" }}>
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      <div style={{ padding: 20 }}>
        {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-robot-off" aria-hidden="true" />
            <p>No agents found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {filtered.map(agent => (
              <BotCard key={agent.id} agent={agent} onSelect={setSelected} onChat={setChatAgent} />
            ))}
          </div>
        )}
      </div>

      {selected && <AgentDetail agent={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
