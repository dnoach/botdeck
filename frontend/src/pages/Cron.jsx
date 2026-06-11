import { useState, useEffect } from "react";
import { apiFetch } from "../hooks/api.js";

function scheduleLabel(schedule) {
  if (!schedule) return "—";
  if (schedule.kind === "cron") {
    return `${schedule.expr} (${schedule.tz || "UTC"})`;
  }
  return schedule.kind;
}

function CronCard({ job }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, opacity: job.enabled ? 1 : 0.55 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14 }}>{job.agentEmoji}</span>
            <span style={{ fontWeight: 500 }}>{job.name}</span>
            {!job.enabled && <span className="tag">disabled</span>}
            {job.agentIdInferred && (
              <span className="tag" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>agent inferred</span>
            )}
          </div>
          {job.description && (
            <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{job.description}</p>
          )}
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
          background: job.enabled ? "var(--green)" : "var(--gray)",
        }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
        {[
          { icon: "ti-robot", label: job.agentName || job.agentId },
          { icon: "ti-clock", label: scheduleLabel(job.schedule) },
          { icon: "ti-send", label: job.delivery?.to ? `${job.delivery.channel} → ${job.delivery.to}` : "No delivery target" },
          job.lastRun && { icon: "ti-history", label: `Last run: ${new Date(job.lastRun).toLocaleString()}` },
          job.lastStatus && { icon: "ti-info-circle", label: `Status: ${job.lastStatus}` },
        ].filter(Boolean).map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text3)" }}>
            <i className={`ti ${row.icon}`} style={{ fontSize: 13, width: 14, flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontFamily: row.icon === "ti-clock" ? "monospace" : "inherit", fontSize: row.icon === "ti-clock" ? 11 : 12 }}>
              {row.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Cron() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    apiFetch("/api/cron")
      .then(r => {
        if (r?.ok) setJobs(r.data?.jobs || []);
        else setError("Could not load cron jobs.");
      })
      .catch(() => setError("Failed to reach backend."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    if (filter === "enabled") return j.enabled;
    if (filter === "disabled") return !j.enabled;
    return true;
  });

  const enabledCount = jobs.filter(j => j.enabled).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Cron jobs</h1>
          <p>{enabledCount} enabled · {jobs.length} total</p>
        </div>
      </div>

      <div style={{ padding: "12px 20px 8px", borderBottom: "0.5px solid var(--border)", background: "var(--surface)", display: "flex", gap: 8 }}>
        {["all", "enabled", "disabled"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            borderRadius: 20,
            background: filter === f ? "var(--purple-light)" : "transparent",
            color: filter === f ? "var(--purple-dark)" : "var(--text2)",
            borderColor: filter === f ? "var(--purple)" : "var(--border2)",
            fontWeight: filter === f ? 500 : 400,
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-clock-off" aria-hidden="true" />
            <p>No cron jobs found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {filtered.map(job => <CronCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </>
  );
}
