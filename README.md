# BotDeck 🤖

A self-hosted management dashboard for [OpenClaw](https://openclaw.ai) multi-agent Telegram bots. Monitor your agents, review conversations, track token usage, manage behaviours, watch live EKG health pulses, and chat with your bots directly — all from a clean, private web UI.

Built with React + Node.js, deployed via Docker, accessed privately over Tailscale.

---

## Features

- **Agent overview** — avatars from `IDENTITY.md`, vibe descriptions, channel bindings, session counts
- **Live EKG pulse** — animated heartbeat wave per agent, speed correlates to recent activity (90 BPM = active now, 28 BPM = dormant)
- **Skeleton shimmer** — smooth loading states throughout
- **Interactive chat** — slide-in chat panel to talk directly with any agent via the OpenClaw gateway
- **Token usage** — real token counts parsed from JSONL session files, per-agent breakdown with cost estimate
- **Conversation logs** — browse sessions by agent, view full message threads as chat bubbles
- **Behaviours editor** — edit `SOUL.md` (system prompt) and description directly from the UI
- **Cron jobs** — view all scheduled tasks with schedule, delivery target, last run status
- **Dark mode** — toggle top right, preference saved in localStorage
- **Password login** — single-password auth with server-side session cookie
- **Private access** — served over Tailscale only, zero public ports exposed

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6, Recharts |
| Backend | Node.js + Express, express-session, node-fetch |
| Data | Reads directly from OpenClaw filesystem via Docker volume |
| Chat | Proxies to OpenClaw `/v1/chat/completions` via host proxy |
| Infrastructure | Docker Compose, Nginx (internal reverse proxy) |
| Network | Tailscale (private HTTPS, no public exposure) |
| Icons | Tabler Icons |

---

## Requirements

- A VPS running [OpenClaw](https://openclaw.ai) with agents configured
- Docker + Docker Compose on the VPS
- Node.js on the VPS host (for the chat proxy)
- A [Tailscale](https://tailscale.com) account (free tier is fine)

---

## Installation

### 1. Clone

```bash
git clone https://github.com/yourusername/botdeck.git
cd botdeck
```

### 2. Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --force-reauth
tailscale serve --bg http://localhost:8080
```

### 3. Install the chat proxy

The chat proxy bridges Docker to OpenClaw's gateway (which runs on loopback only):

```bash
# Copy proxy to permanent location
cp chat-proxy.js /opt/botdeck-proxy.js

# Install as systemd service
cp botdeck-proxy.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable botdeck-proxy
systemctl start botdeck-proxy
```

### 4. Find your Docker bridge IP

```bash
# Start containers first, then:
docker compose up -d
docker network inspect botdeck_botdeck-net | grep Gateway
```

Note the IP (e.g. `172.18.0.1`) — you'll use it in `.env`.

### 5. Configure environment

```bash
cp .env.example .env
nano .env
```

| Variable | Description |
|---|---|
| `OPENCLAW_ROOT` | Path to OpenClaw data dir, default `/root/.openclaw` |
| `SESSION_SECRET` | Random string — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DASHBOARD_PASSWORD` | Password for the BotDeck login screen |
| `OPENCLAW_GATEWAY_URL` | `http://<bridge-ip>:3002` — use IP from step 4 |
| `OPENCLAW_GATEWAY_TOKEN` | Your gateway token from `openclaw.json` → `gateway.auth.token` |

### 6. Enable chat completions in OpenClaw

Add to `openclaw.json` under the `gateway` section:

```json
"http": {
  "endpoints": {
    "chatCompletions": {
      "enabled": true
    }
  }
}
```

Restart OpenClaw after saving.

### 7. Launch

```bash
docker compose up -d --build
```

### 8. Access

From any device on your Tailscale network:
```
https://your-vps-hostname.tail1234.ts.net
```

---

## Project structure

```
botdeck/
├── backend/
│   ├── server.js          # Express API — reads filesystem + proxies chat
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/         # Dashboard, Bots, Tokens, Logs, Behaviours, Cron
│   │   ├── components/    # Sidebar, ChatPanel
│   │   └── hooks/         # useAuth, useTheme, api
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── chat-proxy.js          # Host-side proxy bridging Docker → OpenClaw gateway
├── botdeck-proxy.service  # systemd service for the proxy
├── docker-compose.yml
└── .env.example
```

---

## How it reads data

BotDeck mounts `/root/.openclaw` as a Docker volume and reads directly from the filesystem.

| Data | Source |
|---|---|
| Agent list | `openclaw.json` → `agents.list` |
| Agent identity | `<workspace>/IDENTITY.md` |
| System prompt | `<workspace>/SOUL.md` |
| Sessions | `agents/<id>/sessions/sessions.json` |
| Messages | `agents/<id>/sessions/<sessionId>.jsonl` |
| Token usage | `usage` field in each JSONL message |
| Cron jobs | `cron/jobs.json` or `cron/jobs.json.migrated` |
| Avatars | `<workspace>/avatars/<file>` via `/api/agents/:id/avatar` |

---

## Chat architecture

```
Browser → Nginx → BotDeck Backend (Docker)
                         ↓ http://bridge-ip:3002
                  chat-proxy.js (host process)
                         ↓ http://127.0.0.1:18789
                  OpenClaw Gateway
                         ↓
                  Lucy / Alma (agents)
```

---

## Security

- All traffic private — Tailscale only, no public ports
- Sensitive files never exposed: auth profiles, bot tokens, OAuth state
- Session cookie is `httpOnly`, 24-hour expiry
- Chat proxy only accepts POST requests, validates nothing else

---

## Useful commands

```bash
docker compose ps                        # container status
docker compose logs -f backend           # backend logs
docker compose up -d --build             # rebuild after changes
systemctl status botdeck-proxy           # chat proxy status
journalctl -u botdeck-proxy -f           # chat proxy logs
```

---

## License

MIT — see [LICENSE](LICENSE)

---

<img width="1778" height="761" alt="Screenshot 2026-06-11 at 5 34 41 PM" src="https://github.com/user-attachments/assets/5b2f5eba-e81c-4e32-b8cb-fc08da4d1377" />


## Acknowledgements

Built on top of [OpenClaw](https://openclaw.ai) — a multi-agent AI runtime for Telegram and beyond.
