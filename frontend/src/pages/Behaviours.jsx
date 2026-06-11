import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../hooks/api.js";

export default function Behaviours() {
  const [searchParams] = useSearchParams();
  const agentFilter = searchParams.get("agent");

  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [soul, setSoul] = useState("");
  const [form, setForm] = useState({ description: "" });
  const [loading, setLoading] = useState(true);
  const [loadingSoul, setLoadingSoul] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/agents")
      .then(r => {
        if (r?.ok) {
          const list = r.data?.agents || [];
          setAgents(list);
          const target = agentFilter ? list.find(a => a.id === agentFilter) : list[0];
          if (target) selectAgent(target);
        } else {
          setError("Could not load agents.");
        }
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoading(false));
  }, [agentFilter]);

  const selectAgent = (agent) => {
    setSelected(agent);
    setSaved(false);
    setForm({ description: agent.vibe || "" });
    setLoadingSoul(true);
    apiFetch(`/api/agents/${agent.id}/soul`)
      .then(r => {
        if (r?.ok) setSoul(r.data?.soul || "");
      })
      .finally(() => setLoadingSoul(false));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    const r = await apiFetch(`/api/agents/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ systemPrompt: soul, description: form.description }),
    });
    setSaving(false);
    if (r?.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError("Failed to save. Check backend logs.");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Behaviours</h1>
          <p>Edit agent SOUL.md — the system prompt and personality</p>
        </div>
        <button className="primary" onClick={handleSave} disabled={saving || !selected}>
          {saving ? (
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          ) : saved ? (
            <><i className="ti ti-check" aria-hidden="true" /> Saved</>
          ) : (
            <><i className="ti ti-device-floppy" aria-hidden="true" /> Save to SOUL.md</>
          )}
        </button>
      </div>

      {error && <div className="error-banner" style={{ margin: 20 }}>{error}</div>}

      <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
        {/* Agent list */}
        <div style={{ width: 220, borderRight: "0.5px solid var(--border)", overflowY: "auto", background: "var(--surface)", flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: 40 }}><div className="spinner" /></div>
          ) : agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => selectAgent(agent)}
              style={{
                padding: "12px 16px", cursor: "pointer",
                borderBottom: "0.5px solid var(--border)",
                background: selected?.id === agent.id ? "var(--purple-light)" : "transparent",
                borderRight: selected?.id === agent.id ? "2px solid var(--purple)" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: "var(--surface2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>
                {agent.emoji}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontWeight: 500, fontSize: 13,
                  color: selected?.id === agent.id ? "var(--purple-dark)" : "var(--text)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {agent.identityName}
                </p>
                <p style={{ fontSize: 11, color: "var(--text3)" }}>
                  {agent.isDefault ? "default · " : ""}{agent.id}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {!selected ? (
            <div className="empty-state">
              <i className="ti ti-adjustments-off" aria-hidden="true" />
              <p>Select an agent to edit its behaviour</p>
            </div>
          ) : (
            <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                <span style={{ fontSize: 32 }}>{selected.emoji}</span>
                <div>
                  <p style={{ fontWeight: 500, fontSize: 15 }}>{selected.identityName}</p>
                  <p style={{ fontSize: 12, color: "var(--text3)" }}>
                    {selected.model} · {selected.activeSessionsCount} sessions · {selected.enabledCronJobsCount} cron jobs
                  </p>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6, fontWeight: 500 }}>
                  Description / vibe <span style={{ color: "var(--text3)", fontWeight: 400 }}>(written to IDENTITY.md)</span>
                </label>
                <input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="One-line description of this agent's personality and purpose"
                />
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 500 }}>
                    System prompt <span style={{ color: "var(--text3)", fontWeight: 400 }}>(SOUL.md)</span>
                  </label>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>{soul.length} chars</span>
                </div>
                {loadingSoul ? (
                  <div style={{ padding: 30 }}><div className="spinner" /></div>
                ) : (
                  <textarea
                    value={soul}
                    onChange={e => setSoul(e.target.value)}
                    placeholder="You are Lucy, a helpful and warm assistant..."
                    style={{ minHeight: 320, fontFamily: "monospace", fontSize: 12, lineHeight: 1.65 }}
                  />
                )}
                <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
                  This is saved directly to <code style={{ background: "var(--surface2)", padding: "1px 4px", borderRadius: 3 }}>{selected.workspace}/SOUL.md</code> on your VPS.
                </p>
              </div>

              <div style={{ background: "var(--amber-light)", border: "0.5px solid var(--amber)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 12, color: "var(--amber)" }}>
                <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} aria-hidden="true" />
                Changes take effect on the agent's next conversation turn. Existing sessions are not retroactively affected.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
