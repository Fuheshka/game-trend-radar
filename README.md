# Game Trend Radar 📡🎮

> Cross-platform game market intelligence and trend analyzer for indie developers and studios (Roblox, Yandex Games, YouTube Shorts, Poki).

---

## 🎯 Purpose

Developing a game takes weeks or months. Game Trend Radar prevents the biggest mistake in game development: building a game nobody wants, or entering a saturated red ocean dominated by multi-million-dollar publishers.

The system gathers real-time storefront metrics, classifies gameplay archetypes, and calculates the **Opportunity Score**, outputting an actionable verdict:
- 🟢 **Green Light:** High demand, surging velocity, low saturation, rapid build time (1-4 weeks).
- 🟡 **Yellow Light:** Stable niche, but requires a unique hook (USP) or established asset pipeline.
- 🔴 **Red Light:** Saturated red ocean, declining player interest, or excessive production scope.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ (or Bun)
- npm

### Installation
```bash
npm install
```

### Commands
```bash
# Scan all storefronts (Roblox, Yandex Games, Poki)
npm run scan

# Launch unified Web UI (automatically opens in your default browser)
npm run ui

# Generate comprehensive market report
npm run report

# Get top recommendations on what to build
npm run recommend
```

### Web Dashboard & GitHub Pages
- **Local Dashboard:** `npm run ui` starts the HTTP server on port `:4200` and opens the browser.
- **GitHub Pages:** Automated deployment configured via `.github/workflows/deploy-pages.yml`. Static build: `npm run pages:build`.

---

## 🚀 Production Deployment & PM2

### 1. PM2 Configuration (`ecosystem.config.cjs`)
The production server is orchestrated using [PM2](https://pm2.keymetrics.io/) with automatic restarts on crash, 512MB memory limit, and log management.

```bash
# Start server in production mode
pm2 start ecosystem.config.cjs

# Check server status and monitoring
pm2 status game-trend-radar
pm2 logs game-trend-radar

# Reload with zero downtime after build
pm2 reload ecosystem.config.cjs
```

Key features of `ecosystem.config.cjs`:
- **App name:** `game-trend-radar`
- **Execution target:** Precompiled `dist/server.js` (or fallback to `src/server.ts` with `--import tsx`)
- **Port & Environment:** `PORT=4200`, `NODE_ENV=production`
- **Memory limit:** 512MB (`max_memory_restart: '512M'`)
- **Auto-restart:** Enabled with min uptime 5s
- **Logs:** Stored in `logs/pm2-out.log` and `logs/pm2-error.log` with timestamp formatting

### 2. Automated Deployment Script (`scripts/deploy.sh`)
Deploy updates to the production server with a single command:
```bash
./scripts/deploy.sh
```
The script runs:
1. `git pull` - pulls latest commits
2. `npm install` - updates dependencies
3. `npm run build` and `npm run web:build` - compiles TypeScript and Vite frontend assets
4. `pm2 restart ecosystem.config.cjs` - restarts or boots the server seamlessly

---

## 🔄 Auto-refresh & Realtime (server mode)

Set env vars in `.env` on the server (see [`.env.example`](.env.example); `ecosystem.config.cjs` loads it):

| Variable | Meaning |
|---|---|
| `SCAN_INTERVAL_MIN` | Built-in auto-scan every N minutes (`0` = off, default in PM2: 30). Failed scans retry with exponential backoff; each point is also appended to `data/history/*.jsonl` (14 days). |
| `SCAN_TOKEN` | Bearer token required for `POST /api/scan`. Empty = unprotected (dev only). |
| `SCAN_COOLDOWN_MS` | Min pause between manual scans (429 + `Retry-After` otherwise). |
| `CORS_ORIGIN` | Restrict CORS to your domain (default `*`). |

- `POST /api/scan` returns `202` immediately; progress arrives over SSE. Use `?wait=1` to block until the snapshot is returned.
- A scan with an empty Roblox response is **rejected** (nothing is saved, `scan:failed` is broadcast) — a bad API day cannot overwrite good data. Per-source status is stored in `snapshot.sourceStatus`.
- `GET /healthz` — status (`ok`/`stale`/`empty`), snapshot age, next auto-scan. Use it for uptime monitors.
- `GET /api/history?hours=24` — intraday time series.
- SSE events carry `id:`; reconnecting clients replay missed events via `Last-Event-ID`.
- Static files and API JSON are gzip-compressed with ETag; hashed assets are `immutable`.

### Auto-deploy
`.github/workflows/deploy-server.yml` runs typecheck + tests on push to `main`, then SSHes into the server and runs `scripts/deploy.sh` (ff-only pull, `npm ci`, build, `pm2 reload`, healthcheck, **automatic rollback** on failure). Required repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (optional `DEPLOY_PORT`).

---

## ⏰ Scheduled Nightly Market Scan (Cron)

To keep storefront data fresh, configure a cron job to run daily at **03:00 UTC**.

### Cron Configuration
Open crontab:
```bash
crontab -e
```

Add the following entry:
```cron
# Daily market scan at 03:00 UTC with real-time SSE broadcast
0 3 * * * curl -s -X POST http://127.0.0.1:4200/api/scan >> /path/to/game-trend-radar/logs/cron-scan.log 2>&1
```
*Or using the provided runner script:*
```cron
0 3 * * * /path/to/game-trend-radar/scripts/nightly_scan.sh
```

### Real-Time SSE Broadcasting
When `POST /api/scan` is called:
- The server initiates `runMarketScan` within the active Node.js process.
- Progress events (`scan:started`, `collector:progress` for Roblox, Yandex Games, Poki, and YouTube Shorts, `scan:completed`, and `snapshot:updated`) are streamed to all active dashboard users via Server-Sent Events (`GET /api/events`).
- Active connected clients update their charts and metrics reactively without requiring a manual page reload.

---

## 🌐 Production Web Server Configuration (Nginx & Caddy)

Production configuration files for domain `fuheshka.qd.je` are located in the `deploy/` directory:
- [`deploy/nginx.conf`](deploy/nginx.conf): Nginx reverse proxy with unbuffered SSE (`/api/events`), Gzip compression, and security headers.
- [`deploy/Caddyfile`](deploy/Caddyfile): Alternative Caddy setup with automatic HTTPS and immediate chunk flushing (`flush_interval -1`).

### 1. DNS Configuration (A Record)
Before requesting SSL certificates, bind your domain to your server's public IP address:
1. Open your DNS provider dashboard (e.g., Cloudflare, Namecheap, Reg.ru).
2. Create an **A** record:
   - **Type:** `A`
   - **Name / Host:** `fuheshka` (for zone `qd.je`)
   - **IPv4 Address:** `<YOUR_SERVER_PUBLIC_IP>`
   - **TTL:** `300` (5 minutes) or Auto
   - **Proxy status:** DNS only (disable Cloudflare proxy orange cloud initially so ACME HTTP-01 challenges pass).
3. Verify DNS resolution:
   ```bash
   dig +short fuheshka.qd.je
   # or
   nslookup fuheshka.qd.je
   ```

### 2. Option A: Nginx & Certbot SSL Setup
1. **Copy configuration:**
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/fuheshka.qd.je
   sudo ln -s /etc/nginx/sites-available/fuheshka.qd.je /etc/nginx/sites-enabled/
   ```
2. **Issue SSL certificate via Certbot:**
   - Install Certbot (Ubuntu/Debian):
     ```bash
     sudo apt update && sudo apt install -y certbot python3-certbot-nginx
     ```
   - Obtain and apply certificate automatically:
     ```bash
     sudo certbot --nginx -d fuheshka.qd.je
     ```
   - Verify auto-renewal:
     ```bash
     sudo certbot renew --dry-run
     ```
3. **Verify syntax and reload Nginx:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### 3. Option B: Caddy (Automatic HTTPS)
Caddy automatically provisions, verifies, and renews TLS certificates from Let's Encrypt / ZeroSSL without requiring Certbot:
1. **Copy configuration:**
   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   ```
2. **Validate syntax and reload Caddy:**
   ```bash
   caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

### 4. Verify Real-Time SSE Streaming
Verify that events and heartbeat pings arrive immediately without buffering:
```bash
curl -N -H "Accept: text/event-stream" https://fuheshka.qd.je/api/events
```
You should see heartbeat pings (`: ping`) received every 15 seconds.

---

## 📚 Knowledge Base & Documentation

All core documentation, game design specifications, and prompt roadmaps reside in the Obsidian Vault:
`10 Projects/11 Active/Game Trend Radar — Анализ Рынка и Трендов Игр/`:
- **00 Passport & Vision**
- **01 Data Sources & API Specifications**
- **02 Scoring Model & Decision Engine**
- **03 Game Archetypes & Virality Catalog**
- **08 Prompt Catalog & Code Generation Roadmap**
- **implementation-notes.md** (repository root)

---

## 🛠 Tech Stack
- **Runtime:** Node.js 20+ / TypeScript (ES2022, NodeNext)
- **Execution:** `tsx`
- **Protocols:** Native `fetch`, HTTP/2, REST APIs, Server-Sent Events (SSE)
- **Philosophy:** Modular adapters, strict typing, YAGNI, senior-grade simplicity.

---

## Author & Support

Made with passion and love ❤️

**Daniil K. (Fuheshka)**

- 💬 **Telegram:** [@fuheshka](https://t.me/fuheshka)
- ✉️ **Email:** [me@kuviko.ru](mailto:me@kuviko.ru)
- ☕ **Buy me a coffee (SBP / T-Pay):** [pay.cloudtips.ru/p/7adeaa28](https://pay.cloudtips.ru/p/7adeaa28)
- 💎 **TON:** `UQC-DsraaDQRjUjG9oPRkt5nGlMgxKY-pjMC6xeeYGfxiu9a`
