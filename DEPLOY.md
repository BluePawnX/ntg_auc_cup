# Deploying the Public Hub (and the whole app) to the cloud

This hosts the entire platform — API, the live app, and the read-only public
hub — as **one service** so spectators can follow from anywhere. You create the
accounts and click deploy; the app is already configured for it.

You'll do two things: (1) a free **MongoDB Atlas** database, (2) deploy the
**Docker** image to a free host (Render shown; Railway/Fly are similar).

---

## 1. Database — MongoDB Atlas (free)

1. Sign up at https://www.mongodb.com/atlas and create a **free M0 cluster**.
2. **Database Access** → add a user (username + password).
3. **Network Access** → Allow access from anywhere (`0.0.0.0/0`) — simplest for
   a hosted app. (Tighten later if you wish.)
4. **Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxx.mongodb.net/ntg-platform`
   Add the database name `ntg-platform` before the `?` if it isn't there.

Keep that string — it's your `MONGO_URI`.

---

## 2. Deploy — Render (free)

1. Push this `ntg-platform/` folder to a GitHub repo.
2. At https://render.com → **New → Blueprint**, point it at the repo. It reads
   `render.yaml` and creates one Docker web service.
   - Or **New → Web Service**, pick "Docker", and use the included `Dockerfile`.
3. Set environment variables on the service:
   - `MONGO_URI` = your Atlas string from step 1.
   - `JWT_SECRET` = a long random string (Render can generate it).
   - Leave `CLIENT_ORIGIN` unset (CORS then accepts the deployed origin).
4. Deploy. When it's live you'll get a URL like
   `https://ntg-tournament-platform.onrender.com`.
5. Health check: open `…/api/health` — it should return `{"ok":true}`.

The Dockerfile builds the client and the server serves it, so the **same URL**
hosts the app and the hub — no separate frontend deploy, no CORS juggling.

---

## 3. Seed the tournament (once)

The cloud database starts empty. Seed it once:
- In Render → your service → **Shell**, run: `npm run seed`
  (uses the same `MONGO_URI`, loads `server/src/seed/players.csv`).
- Re-running it re-seeds the same Cup cleanly.

> To use real players, replace `server/src/seed/players.csv` (same columns)
> before deploying, or open self-registration (Settings) and approve players.

---

## 4. Share it

- **Public hub:** `https://<your-app>.onrender.com/hub/<tournament-id>` — the
  Hub link inside the admin header has the exact URL.
- **Self-registration:** `https://<your-app>.onrender.com/register`.
- **Operators** log in at the root URL as usual.

---

## Notes

- **Free tiers sleep.** Render's free service spins down when idle and takes
  ~30s to wake on the next request — fine for a spectator hub, not for the
  live auction. Run the **auction itself on the venue laptop** (see RUNBOOK.md)
  and use the cloud hub for spectators, or upgrade to a paid tier for always-on.
- **Change the seeded passwords** (`server/src/seed/config.js`) before a public
  deploy, then re-seed.
- **Local single-service:** you can also run the production setup locally —
  `cd client && npm run build`, then `cd server && npm start`. The server then
  serves the app at `http://localhost:4000` (one port, no Vite).
