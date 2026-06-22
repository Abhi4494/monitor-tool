# website-monitor

Two-package uptime/health monitoring system.

```
website-monitor
 ├── monitor-server (Node.js)
 │    ├── Playwright   – headless browser check (JS/console/CSS errors)
 │    ├── Cron         – runs all checks on a schedule
 │    ├── Email        – alerts on failures (nodemailer)
 │    └── Socket.IO    – pushes live results to the dashboard
 │
 └── monitor-dashboard (Next.js)
      ├── Live Status  – real-time cards over Socket.IO
      ├── Error Logs   – failed checks (REST, from DB)
      └── Alerts       – failures that emailed (REST + live)
```

## How it works

The server runs three checks (website HTTP, API HTTP, Playwright browser) on a
cron schedule. Each result is **persisted** to MySQL (`check_results` table),
**broadcast** live over Socket.IO, and on `DOWN`/`FAILED` an **email alert** is
sent. The dashboard reads history over REST and live status over Socket.IO.

## monitor-server

```bash
cd monitor-server
npm install
# configure .env (DB + mail + targets), then:
npm start          # http://localhost:5000
```

REST endpoints:
- `GET /api/status`  – latest result per check type
- `GET /api/results` – recent results (`?type=`, `?limit=`)
- `GET /api/logs`    – failed checks only
- `GET /api/alerts`  – failures that triggered an email

Socket.IO events: `check:result`, `check:alert`, `check:cycle`.

### Admin login

The dashboard is gated by admin login (JWT). Create the first admin from the
server package:

```bash
cd monitor-server
npm run create-admin -- admin@example.com "YourPassword" "Your Name"
```

Set a strong `JWT_SECRET` in `.env`. Additional admins can be created the same
way, or via `POST /api/auth/register` (requires a valid token).

### Adding sites to monitor

Targets live in the **database** and are managed from the dashboard:
log in → **Targets** tab → add/edit/delete. Each target has:

- `name` — label shown on the dashboard
- `type` — `WEBSITE` (HTTP + latency), `API` (HTTP status), or `BROWSER`
  (Playwright: first-party JS/CSS/page errors)
- `url` — what to check
- `emails` — comma-separated recipients for **that target's** alerts (falls
  back to `ALERT_TO` in `.env` if empty)
- `active` — toggle to pause monitoring without deleting

On first boot, the legacy
[`targets.json`](monitor-server/src/config/targets.json) is imported into the DB
once as a starting point; after that the DB is the source of truth.

Auth + target endpoints:
- `POST /api/auth/login` → `{ token, user }`
- `GET /api/auth/me` (auth) → current admin
- `POST /api/auth/register` (auth) → create another admin
- `GET/POST/PUT/DELETE /api/targets` (auth) → manage targets

Requires a MySQL database named in `.env` (`DB_NAME=monitor`). The table is
auto-created on boot via `sequelize.sync()`. If the DB is unreachable the server
still runs and broadcasts live results — only REST history is unavailable.

## monitor-dashboard

```bash
cd monitor-dashboard
npm install
# .env.local: NEXT_PUBLIC_SERVER_URL=http://localhost:5000
npm run dev        # http://localhost:3000
```
