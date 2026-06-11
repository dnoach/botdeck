require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3001;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";
const OPENCLAW_ROOT = process.env.OPENCLAW_ROOT || "/root/.openclaw";
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://host.docker.internal:18789";
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const OPENCLAW_HOST_PATH = "/root/.openclaw";

// Remap paths from openclaw.json (host paths) to container mount paths
function remapPath(p) {
  if (!p) return p;
  return p.replace(OPENCLAW_HOST_PATH, OPENCLAW_ROOT);
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 1000 * 60 * 60 * 24 },
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Unauthorised" });
}

app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });
  if (password === DASHBOARD_PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Invalid password" });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  res.json({ authenticated: !!(req.session?.authenticated) });
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ── Filesystem helpers ────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Parse IDENTITY.md for name, emoji, vibe, avatar — returns object
function parseIdentityMd(workspace) {
  const content = readFile(path.join(workspace, "IDENTITY.md"));
  if (!content) return {};
  const result = {};

  // Parse bullet-point fields: * Key: Value
  const lines = content.split("\n");
  lines.forEach(line => {
    const match = line.match(/^[-*]+\s*\*{0,2}([\w]+)\*{0,2}\s*:\s*(.+)$/);
    if (!match) return;
    const key = match[1].trim().toLowerCase();
    const val = match[2].trim().replace(/^\*+|\*+$/g, "").trim();
    if (key === "name")   result.identityName = val;
    if (key === "emoji")  result.emoji = val;
    if (key === "vibe")   result.vibe = val;
    if (key === "avatar") result.avatarPath = val; // relative path e.g. avatars/lucy.png
  });

  return result;
}

// Check if HEARTBEAT.md has active content (non-empty, non-comment lines)
function hasActiveHeartbeat(workspace) {
  const content = readFile(path.join(workspace, "HEARTBEAT.md"));
  if (!content) return false;
  return content.split("\n").some(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("#") && !trimmed.startsWith("<!--");
  });
}

// Read sessions.json for an agent
function getAgentSessions(agentId) {
  const sessionsPath = path.join(OPENCLAW_ROOT, "agents", agentId, "sessions", "sessions.json");
  const raw = readJson(sessionsPath);
  if (!raw) return [];

  return Object.entries(raw).map(([key, session]) => ({
    sessionKey: key,
    sessionId: session.sessionId,
    chatType: session.chatType,
    lastChannel: session.lastChannel,
    updatedAt: session.updatedAt,
    lastInteractionAt: session.lastInteractionAt,
    origin: session.origin,
    route: session.route,
    sessionFile: session.sessionFile,
    abortedLastRun: session.abortedLastRun || false,
    agentId,
  }));
}

// Count messages in a .jsonl session file
function countMessagesInJsonl(sessionFile) {
  if (!sessionFile) return 0;
  const filePath = remapPath(path.isAbsolute(sessionFile)
    ? sessionFile
    : path.join(OPENCLAW_ROOT, sessionFile));
  try {
    const content = readFile(filePath);
    if (!content) return 0;
    return content.split("\n").filter(l => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

// Read messages from a .jsonl file — returns safe subset (no private content)
function readSessionMessages(sessionFile, limit = 200) {
  const filePath = remapPath(path.isAbsolute(sessionFile)
    ? sessionFile
    : path.join(OPENCLAW_ROOT, sessionFile));
  try {
    const raw = readFile(filePath);
    if (!raw) return [];

    const messages = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        // Only process type=message entries
        if (obj.type !== "message" || !obj.message) continue;

        const msg = obj.message;
        const role = msg.role;
        if (!role) continue;

        // Extract text from content array
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          text = msg.content
            .filter(c => c.type === "text" || c.type === "thinking")
            .map(c => c.text || c.thinking || "")
            .join("\n")
            .trim();
        }

        if (!text) continue;

        // Strip cron prefix from user messages e.g. "[cron:xxx Wake-up] actual message"
        const cronPrefix = text.match(/^\[cron:[^\]]+\]\s*/);
        if (cronPrefix) text = text.slice(cronPrefix[0].length).split("\nCurrent time:")[0].trim();

        messages.push({
          role,
          content: text,
          timestamp: obj.timestamp || null,
          model: msg.model || null,
        });
      } catch { /* skip malformed lines */ }
    }

    return messages.slice(-limit);
  } catch {
    return [];
  }
}

// Calculate real token usage by parsing JSONL session files
function getAgentUsage(agentId) {
  const sessionsDir = path.join(OPENCLAW_ROOT, "agents", agentId, "sessions");
  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;
  let messageCount = 0;

  try {
    const files = fs.readdirSync(sessionsDir).filter(f =>
      f.endsWith(".jsonl") && !f.includes("trajectory")
    );

    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      const lines = (readFile(filePath) || "").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const usage = obj.message?.usage;
          if (!usage) continue;
          inputTokens  += usage.input       || 0;
          outputTokens += usage.output      || 0;
          totalTokens  += usage.totalTokens || (usage.input + usage.output) || 0;
          messageCount++;
          // OpenRouter cost object mirrors token counts as negatives — not dollars
          // Estimate cost using token counts with blended openrouter/auto pricing
          // ~$50 per 1M input tokens, ~$150 per 1M output tokens
          totalCost += ((usage.input || 0) / 1_000_000) * 50 +
                       ((usage.output || 0) / 1_000_000) * 150;
        } catch { /* skip malformed lines */ }
      }
    }
  } catch { /* directory unreadable */ }

  return { totalTokens, inputTokens, outputTokens, totalCost, messageCount };
}

// ── Agent data builder ────────────────────────────────────────────────────────

function buildAgentList() {
  const config = readJson(path.join(OPENCLAW_ROOT, "openclaw.json"));
  if (!config) { console.error("ERROR: Could not read openclaw.json from", OPENCLAW_ROOT); return []; }
  console.log("Loaded config, agents:", (config.agents?.list || []).map(a => a.id));

  // Try openclaw CLI first, fall back to config parsing
  let cliAgents = null;
  try {
    const out = execSync("openclaw agents list --bindings --json", { timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).toString();
    cliAgents = JSON.parse(out);
  } catch {
    // CLI not available inside container — use config
  }

  const defaults = config.agents?.defaults || {};
  const agentList = cliAgents || config.agents?.list || [];
  const bindings = config.bindings || [];

  return agentList.map(agent => {
    const workspace = remapPath(agent.workspace || defaults.workspace || "");
    const agentId = agent.id;
    const identity = parseIdentityMd(workspace);
    const sessions = getAgentSessions(agentId);
    const usage = getAgentUsage(agentId);
    const agentBindings = bindings.filter(b => b.agentId === agentId);
    const heartbeat = hasActiveHeartbeat(workspace);

    // Count cron jobs for this agent
    const cronRaw = readJson(path.join(OPENCLAW_ROOT, "cron", "jobs.json")) || {};
    const cronJobs = Array.isArray(cronRaw) ? cronRaw : (cronRaw.jobs || Object.values(cronRaw));
    const myJobs = cronJobs.filter(j => (j.agentId || "main") === agentId);

    // Last interaction across all sessions
    const lastInteractions = sessions
      .map(s => s.lastInteractionAt)
      .filter(Boolean)
      .sort()
      .reverse();

    return {
      id: agentId,
      identityName: agent.identityName || identity.identityName || agentId,
      emoji: agent.emoji || identity.emoji || "🤖",
      vibe: identity.vibe || null,
      avatarPath: identity.avatarPath || null,
      workspace,
      agentDir: remapPath(agent.agentDir) || path.join(OPENCLAW_ROOT, "agents", agentId, "agent"),
      model: agent.model || defaults.model?.primary || "unknown",
      isDefault: agent.isDefault || false,
      status: "online", // OpenClaw doesn't expose live status via file; assume online
      bindings: agentBindings.map(b => ({
        channel: b.match?.channel,
        accountId: b.match?.accountId,
      })),
      hasHeartbeat: heartbeat,
      activeSessionsCount: sessions.length,
      cronJobsCount: myJobs.length,
      enabledCronJobsCount: myJobs.filter(j => j.enabled).length,
      lastInteractionAt: lastInteractions[0] || null,
      usage: {
        totalCost: usage.totalCost || 0,
        totalTokens: usage.totalTokens || 0,
      },
    };
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/agents
app.get("/api/agents", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: "Failed to load agents", detail: err.message });
  }
});

// GET /api/agents/:id
app.get("/api/agents/:id", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: "Failed to load agent", detail: err.message });
  }
});

// PATCH /api/agents/:id — update IDENTITY.md or SOUL.md fields
app.patch("/api/agents/:id", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const { systemPrompt, description } = req.body;

    // Write system prompt to SOUL.md
    if (systemPrompt !== undefined) {
      const soulPath = path.join(agent.workspace, "SOUL.md");
      fs.writeFileSync(soulPath, systemPrompt, "utf8");
    }

    // Write description to IDENTITY.md (append/update vibe line)
    if (description !== undefined) {
      const identityPath = path.join(agent.workspace, "IDENTITY.md");
      let content = readFile(identityPath) || "";
      if (content.match(/vibe:/i)) {
        content = content.replace(/vibe:[^\n]*/i, `vibe: ${description}`);
      } else {
        content += `\nvibe: ${description}`;
      }
      fs.writeFileSync(identityPath, content, "utf8");
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update agent", detail: err.message });
  }
});

// GET /api/agents/:id/soul — read SOUL.md (system prompt)
app.get("/api/agents/:id/soul", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    const soul = readFile(path.join(agent.workspace, "SOUL.md")) || "";
    res.json({ soul });
  } catch (err) {
    res.status(500).json({ error: "Failed to read SOUL.md", detail: err.message });
  }
});

// GET /api/sessions?agentId=xxx
app.get("/api/sessions", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const filter = req.query.agentId;
    const targets = filter ? agents.filter(a => a.id === filter) : agents;

    const sessions = targets.flatMap(agent => {
      const s = getAgentSessions(agent.id);
      return s.map(sess => ({
        ...sess,
        agentName: agent.identityName,
        agentEmoji: agent.emoji,
      }));
    });

    // Sort by most recent
    sessions.sort((a, b) => {
      const ta = Number(a.lastInteractionAt || a.updatedAt || 0);
      const tb = Number(b.lastInteractionAt || b.updatedAt || 0);
      return tb - ta;
    });

    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions", detail: err.message });
  }
});

// GET /api/sessions/:agentId/:sessionId/messages
app.get("/api/sessions/:agentId/:sessionId/messages", requireAuth, (req, res) => {
  try {
    const { agentId, sessionId } = req.params;
    const sessionsData = readJson(
      path.join(OPENCLAW_ROOT, "agents", agentId, "sessions", "sessions.json")
    ) || {};

    // Find session file by sessionId
    const sessionEntry = Object.values(sessionsData).find(s => s.sessionId === sessionId);
    if (!sessionEntry?.sessionFile) {
      return res.status(404).json({ error: "Session file not found" });
    }

    const messages = readSessionMessages(sessionEntry.sessionFile, 200);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: "Failed to load messages", detail: err.message });
  }
});

// GET /api/usage — aggregate usage across all agents
app.get("/api/usage", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const perAgent = agents.map(a => ({
      agentId: a.id,
      agentName: a.identityName,
      emoji: a.emoji,
      totalCost: a.usage.totalCost,
      totalTokens: a.usage.totalTokens,
      inputTokens: a.usage.inputTokens,
      outputTokens: a.usage.outputTokens,
      messageCount: a.usage.messageCount,
    }));

    const totalCost = perAgent.reduce((s, a) => s + (a.totalCost || 0), 0);
    const totalTokens = perAgent.reduce((s, a) => s + (a.totalTokens || 0), 0);
    const totalMessages = perAgent.reduce((s, a) => s + (a.messageCount || 0), 0);

    const allSessions = agents.flatMap(a => getAgentSessions(a.id));

    res.json({
      totalCost,
      totalTokens,
      totalMessages,
      perAgent,
      activeAgents: agents.filter(a => a.status === "online").length,
      totalAgents: agents.length,
      totalSessions: allSessions.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load usage", detail: err.message });
  }
});

// GET /api/cron — all cron jobs
app.get("/api/cron", requireAuth, (req, res) => {
  try {
    const cronRaw2 = readJson(path.join(OPENCLAW_ROOT, "cron", "jobs.json")) || {};
    const jobs = Array.isArray(cronRaw2) ? cronRaw2 : (cronRaw2.jobs || Object.values(cronRaw2));
    const state = readJson(path.join(OPENCLAW_ROOT, "cron", "jobs-state.json")) || {};
    const agents = buildAgentList();

    const enriched = jobs.map(job => {
      const agentId = job.agentId || "main";
      const agent = agents.find(a => a.id === agentId);
      const jobState = state[job.id] || {};
      return {
        id: job.id,
        agentId,
        agentName: agent?.identityName || agentId,
        agentEmoji: agent?.emoji || "🤖",
        agentIdInferred: !job.agentId,
        name: job.name,
        description: job.description,
        enabled: job.enabled,
        schedule: job.schedule,
        sessionTarget: job.sessionTarget,
        delivery: {
          channel: job.delivery?.channel,
          to: job.delivery?.to,
        },
        lastRun: jobState.lastRun || null,
        lastStatus: jobState.lastStatus || null,
      };
    });

    res.json({ jobs: enriched });
  } catch (err) {
    res.status(500).json({ error: "Failed to load cron jobs", detail: err.message });
  }
});

// GET /api/agents/:id/avatar — serve the agent avatar image
app.get("/api/agents/:id/avatar", requireAuth, (req, res) => {
  try {
    const agents = buildAgentList();
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    if (!agent.avatarPath) return res.status(404).json({ error: "No avatar set" });

    // avatarPath is relative to workspace e.g. "avatars/lucy.png"
    const fullPath = path.join(agent.workspace, agent.avatarPath);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ error: "Avatar file not found" });

    res.sendFile(fullPath);
  } catch (err) {
    res.status(500).json({ error: "Failed to serve avatar", detail: err.message });
  }
});

// POST /api/chat/:agentId — proxy chat message to OpenClaw gateway
app.post("/api/chat/:agentId", requireAuth, async (req, res) => {
  const { agentId } = req.params;
  const { message, sessionKey } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  if (!OPENCLAW_GATEWAY_TOKEN) return res.status(503).json({ error: "Gateway token not configured" });

  try {
    const body = {
      model: `openclaw:${agentId}`,
      messages: [{ role: "user", content: message }],
      stream: false,
    };

    // Use session key to maintain conversation continuity
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
    };
    if (sessionKey) headers["x-openclaw-session-key"] = sessionKey;

    const gwRes = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await gwRes.json();
    const reply = data.choices?.[0]?.message?.content || "";
    res.json({ reply, usage: data.usage });
  } catch (err) {
    res.status(502).json({ error: "Gateway unreachable", detail: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`BotDeck backend running on port ${PORT}`);
  console.log(`OpenClaw root: ${OPENCLAW_ROOT}`);
});
