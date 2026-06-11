import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { apiFetch } from "../hooks/api.js";

function tokenColor(pct) {
  if (pct > 80) return "var(--red)";
  if (pct > 50) return "var(--amber)";
  return "#7F77DD";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "var(--text3)" }}>Day {label}</p>
      <p style={{ fontWeight: 500 }}>{(payload[0].value / 1000).toFixed(1)}K tokens</p>
    </div>
  );
};

export default function Tokens() {
  const [usage, setUsage] = useState(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/usage"), apiFetch("/api/agents")])
      .then(([u, a]) => {
        if (u?.ok) setUsage(u.data);
        else setError("Could not load usage data.");
        if (a?.ok) setAgents(a.data?.agents || a.data || []);
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoading(false));
  }, []);

  const totalTokens = usage?.totalTokens ?? 0;
  const tokenLimit = usage?.tokenLimit ?? 2_000_000;
  const tokenPct = Math.round((totalTokens / tokenLimit) * 100);

  const dailyData = usage?.daily ?? Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    tokens: 0,
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Token usage</h1>
          <p>Monthly consumption across all bots</p>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div style={{ padding: 60 }}><div className="spinner" /></div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Total tokens", value: totalTokens > 0 ? `${Math.round(totalTokens / 1000)}K` : "0", sub: "all time" },
                { label: "Total cost", value: `$${(usage?.totalCost || 0).toFixed(4)}`, sub: "all time" },
                { label: "Total messages", value: usage?.totalMessages?.toLocaleString() || "0", sub: "across all agents" },
                { label: "Active agents", value: usage?.activeAgents || "0", sub: `of ${usage?.totalAgents || 0} total` },
              ].map((s) => (
                <div key={s.label} className="card" style={{ background: "var(--surface2)" }}>
                  <p style={{ fontSize: 12, color: "var(--text3)" }}>{s.label}</p>
                  <p style={{ fontSize: 22, fontWeight: 500, margin: "4px 0 2px" }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: "var(--text3)" }}>{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontWeight: 500 }}>Daily usage — this month</p>
                <p style={{ fontSize: 12, color: "var(--text3)" }}>{Math.round(totalTokens / 1000)}K / {Math.round(tokenLimit / 1000)}K</p>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="token-track" style={{ height: 6 }}>
                  <div className="token-fill" style={{ width: `${tokenPct}%`, background: tokenColor(tokenPct) }} />
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailyData} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--purple-light)" }} />
                  <Bar dataKey="tokens" radius={[3, 3, 0, 0]}>
                    {dailyData.map((entry, i) => (
                      <Cell key={i} fill={i === dailyData.length - 1 ? "#AFA9EC" : "#7F77DD"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <p style={{ fontWeight: 500, marginBottom: 14 }}>Usage per agent</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {usage?.perAgent?.length === 0 && (
                  <p style={{ color: "var(--text3)", fontSize: 13 }}>No agents found.</p>
                )}
                {(usage?.perAgent || []).map((agent) => {
                  const maxTokens = Math.max(...(usage.perAgent.map(a => a.totalTokens || 0)));
                  const pct = maxTokens > 0 ? Math.round(((agent.totalTokens || 0) / maxTokens) * 100) : 0;
                  return (
                    <div key={agent.agentId}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: "var(--purple-light)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                        }}>
                          {agent.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{agent.agentName}</span>
                            <span style={{ color: "var(--text3)", fontSize: 11 }}>
                              {agent.totalTokens ? `${Math.round(agent.totalTokens / 1000)}K tokens` : "0 tokens"}
                            </span>
                          </div>
                          <div className="token-track">
                            <div className="token-fill" style={{ width: `${pct}%`, background: tokenColor(pct) }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text3)", paddingLeft: 44 }}>
                        <span>↑ {Math.round((agent.inputTokens || 0) / 1000)}K input</span>
                        <span>↓ {Math.round((agent.outputTokens || 0) / 1000)}K output</span>
                        <span>{agent.messageCount || 0} messages</span>
                        <span style={{ marginLeft: "auto", color: "var(--text2)", fontWeight: 500 }}>
                          ${(agent.totalCost || 0).toFixed(4)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
