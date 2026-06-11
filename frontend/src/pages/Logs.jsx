import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../hooks/api.js";

function chatTypeIcon(chatType) {
  if (chatType === "group") return "ti-users";
  if (chatType === "direct") return "ti-user";
  if (chatType === "cron") return "ti-clock";
  return "ti-message-circle";
}

function sessionLabel(session) {
  const key = session.sessionKey || "";
  if (key.includes("telegram:group")) return `Group ${key.split(":").pop()}`;
  if (key.includes("telegram:direct")) return `DM ${key.split(":").pop()}`;
  if (key.includes("cron")) return `Cron · ${key.split(":").pop()}`;
  if (key.includes(":main")) return "Main session";
  return key.split(":").slice(-1)[0] || key;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  if (!msg.content?.trim()) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 3 }}>
      <div style={{
        maxWidth: "75%",
        background: isUser ? "var(--purple-light)" : "var(--surface2)",
        color: isUser ? "var(--purple-dark)" : "var(--text)",
        borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
        padding: "8px 12px", fontSize: 13, lineHeight: 1.55,
      }}>
        {msg.content}
      </div>
      {msg.timestamp && (
        <span style={{ fontSize: 10, color: "var(--text3)" }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

export default function Logs() {
  const [searchParams] = useSearchParams();
  const agentFilter = searchParams.get("agent");

  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState("");
  const [agentSearch, setAgentSearch] = useState("");

  useEffect(() => {
    const url = agentFilter ? `/api/sessions?agentId=${agentFilter}` : "/api/sessions";
    apiFetch(url)
      .then(r => {
        if (r?.ok) {
          const list = r.data?.sessions || [];
          setSessions(list);
          if (list.length > 0) setSelected(list[0]);
        } else {
          setError("Could not load sessions.");
        }
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoadingSessions(false));
  }, [agentFilter]);

  useEffect(() => {
    if (!selected?.sessionId) return;
    setLoadingMsgs(true);
    setMessages([]);
    apiFetch(`/api/sessions/${selected.agentId}/${selected.sessionId}/messages`)
      .then(r => {
        if (r?.ok) setMessages(r.data?.messages || []);
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [selected]);

  const filteredSessions = sessions.filter(s => {
    if (!agentSearch) return true;
    return s.agentName?.toLowerCase().includes(agentSearch.toLowerCase()) ||
           sessionLabel(s).toLowerCase().includes(agentSearch.toLowerCase());
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Logs</h1>
          <p>{sessions.length} sessions across all agents</p>
        </div>
      </div>

      {error && <div className="error-banner" style={{ margin: 20 }}>{error}</div>}

      <div style={{ display: "flex", height: "calc(100vh - 57px)" }}>
        {/* Session list */}
        <div style={{ width: 260, borderRight: "0.5px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--surface)", flexShrink: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: "0.5px solid var(--border)" }}>
            <input
              type="text"
              placeholder="Filter sessions..."
              value={agentSearch}
              onChange={e => setAgentSearch(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingSessions ? (
              <div style={{ padding: 40 }}><div className="spinner" /></div>
            ) : filteredSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}>
                <i className="ti ti-messages-off" aria-hidden="true" />
                <p style={{ fontSize: 12 }}>No sessions found</p>
              </div>
            ) : (
              filteredSessions.map(s => {
                const isActive = selected?.sessionKey === s.sessionKey;
                return (
                  <div
                    key={`${s.agentId}-${s.sessionKey}`}
                    onClick={() => setSelected(s)}
                    style={{
                      padding: "10px 14px", cursor: "pointer",
                      borderBottom: "0.5px solid var(--border)",
                      background: isActive ? "var(--purple-light)" : "transparent",
                      borderRight: isActive ? "2px solid var(--purple)" : "2px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{s.agentEmoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? "var(--purple-dark)" : "var(--text)" }}>
                        {s.agentName}
                      </span>
                      {s.abortedLastRun && (
                        <i className="ti ti-alert-triangle" style={{ fontSize: 11, color: "var(--amber)", marginLeft: "auto" }} title="Last run aborted" aria-hidden="true" />
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text3)" }}>
                      <i className={`ti ${chatTypeIcon(s.chatType)}`} style={{ fontSize: 11 }} aria-hidden="true" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sessionLabel(s)}
                      </span>
                    </div>
                    {s.lastInteractionAt && (
                      <p style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>
                        {new Date(s.lastInteractionAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Message thread */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selected && (
            <div style={{ padding: "10px 16px", borderBottom: "0.5px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{selected.agentEmoji}</span>
              <div>
                <p style={{ fontWeight: 500, fontSize: 13 }}>{selected.agentName} · {sessionLabel(selected)}</p>
                <p style={{ fontSize: 11, color: "var(--text3)" }}>
                  {selected.chatType} · {selected.lastChannel || selected.route?.channel || "—"}
                  {selected.abortedLastRun && <span style={{ color: "var(--amber)", marginLeft: 8 }}>⚠ last run aborted</span>}
                </p>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {!selected ? (
              <div className="empty-state">
                <i className="ti ti-message-circle" aria-hidden="true" />
                <p>Select a session to view messages</p>
              </div>
            ) : loadingMsgs ? (
              <div style={{ padding: 60 }}><div className="spinner" /></div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-messages-off" aria-hidden="true" />
                <p>No messages in this session</p>
              </div>
            ) : (
              messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
