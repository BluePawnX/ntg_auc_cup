# NTG Tournament Platform — Event-Day Runbook

A step-by-step operator guide for running the auction and match day. Keep this
open on the host laptop.

---

## 0. What you need

- **One host laptop** (Windows) with **Node.js** installed.
- The venue **Wi-Fi** (or a phone hotspot). No internet required for the app
  itself.
- That's it. MongoDB is **optional** — the quick-start launcher runs an
  in-memory database so you can go with only Node installed.

Everything lives in `ntg-platform/`:
- `server/` — the backend, database logic, and all the launchers (`.bat` files).
- `client/` — the web app (the three terminals + admin screens + public hub).

---

## 1. Quick start (recommended — no MongoDB install)

On the host laptop, in `ntg-platform/server/`:

1. **Double-click `start-dev.bat`** — installs dependencies, boots an in-memory
   database, seeds the tournament, and starts the backend on port **4000**.
   Leave this window open. (First run downloads a small DB engine — be patient.)
2. **Double-click `start-client.bat`** — installs and starts the web app. Leave
   it open. It prints two addresses, e.g.:
   - `Local:   http://localhost:5173/`
   - `Network: http://192.168.1.50:5173/`  ← **this is the address everyone uses.**

> Production option (real MongoDB): install MongoDB, then use `verify.bat`
> (installs, tests, seeds, starts the server, runs a smoke test) followed by
> `start-client.bat`. The data then persists across restarts.

---

## 2. Connect the room

- **Auctioneer (host laptop):** open the Network address and go to `/auctioneer`.
- **TV / projector:** open the Network address and go to `/observer`.
- **Each captain (their phone):** open the **Network** address (e.g.
  `http://192.168.1.50:5173`) on the venue Wi-Fi.

To find the laptop's IP if the Network line isn't shown: open Command Prompt,
run `ipconfig`, use the IPv4 address. CORS is already configured to accept any
LAN origin.

---

## 3. Logins

Seeded accounts (change passwords before a public event — see §8):

| Who | Username | Password |
|-----|----------|----------|
| Admin | `admin` | `ntg-admin-2026` |
| Auctioneer | `auctioneer` | `ntg-auctioneer-2026` |
| Captains | their team slug | `captain-2026` |

Captain slugs are the team name lowercased with dashes: `0-ping`, `bajil-squad`,
`bommbaclat`, `chutki`, `indian-oil-esports`, `kadri-knights`, `kulshekar-kings`,
`sher-e-urdu`, `team-lodus`, `zenith`. After login each role lands on its own
terminal automatically.

---

## 4. Before the auction — tune the economy (optional)

Sign in as admin/auctioneer → **Settings**. You can edit, with no code:
- Starting budget, timer length, minimum bid increment.
- The rank table — each rank's **core cost** (deducted from the budget) and
  **floor price** (a pool player's opening bid).

Click **Apply & recompute** to re-derive every team budget and player floor from
the new numbers. This is allowed **only before the first sale** — once the
auction starts the economy locks (the screen will tell you).

To load a different/updated player list, replace `server/src/seed/players.csv`
(same columns) and re-run `start-dev.bat`.

---

## 5. Running the auction

**Auctioneer terminal:**
1. **Draw player** — picks a random player and shows the profile (showcase).
2. **Start bidding** — opens bidding; the 15-second server countdown begins and
   resets to full on every bid.
3. Captains bid from their phones. The BID button enforces the rules for them
   (minimum increment, can't outbid yourself, and the reserve cap so no team can
   strand itself).
4. **Hammer** to sell early, or let the timer hit zero. No bids → **Unsold**
   (collected for a second pass).
5. **Pause/Resume** if you need a break. **Undo last sale** fixes a mistaken sale
   (refunds credits, frees the slot).
6. When the main pool is done, switch **Draw from → Pass 2** for the unsold
   players.

The **Observer** TV shows the live player, price, top bidder, the big timer, all
rosters, and a sold ticker.

**If the host laptop restarts mid-auction:** just re-run the launcher. The auction
state is persisted; a running timer resumes where it left off (with real
MongoDB; the in-memory launcher reseeds fresh).

---

## 6. Match day

Sign in as admin/auctioneer → **Match Day**.

**Schedule tab:** add fixtures (round, the two teams, time), enter scores, mark a
match live/complete, and **record a poach** (a player moving teams after a
match — rosters update, but past stats keep their original team, so history
stays intact).

**Stats tab:** pick a match, then either type each player's K/D/A/First-Bloods/
Plants, **or paste the scoreboard** (CSV `Name, k, d, a, fb, plants` or
space-separated) and hit **Import → prefill**, then adjust and **Save stats**.
Stats are editable after entry.

**Public hub:** share `http://<laptop-ip>:5173/hub/<tournament-id>` (the **Hub**
link in the header has it). It's read-only, needs no login, and shows the
schedule, leaderboard, MVP race, Watchlist/Washed list, and price-vs-performance
— updating as you enter results and stats.

---

## 7. Verifying everything works

From `server/`:
- `npm test` — unit suites (bid/reserve, economy, analytics, parser, rate limit).
- **`run-e2e.bat`** — full end-to-end check (auth, auction, match day, analytics,
  hub, validation, security) on an isolated port; writes `e2e-report.txt`.
- **`rehearse.bat`** — a full 10-captain auction dry run; writes
  `rehearsal-report.txt`.

These are self-contained (own database + port) and safe to run alongside a live
app.

---

## 8. Security & housekeeping

- **Change the default passwords** before any public-facing use. (For now they're
  set in `server/src/seed/config.js`; re-seed after changing.)
- **Rate limiting** is on: login is capped per IP (brute-force guard), with a
  generous overall API cap. Tighten the login cap in `server/src/index.js` if you
  want it stricter for a public deployment.
- The **public hub** is intentionally open (read-only). Don't expose the admin/
  auctioneer logins outside the operator team.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| A phone can't reach the app | Confirm it's on the **same Wi-Fi** and using the **Network** address (not `localhost`). Check the laptop firewall isn't blocking ports 4000/5173. |
| "Port already in use" | An old server window is still running — close it, or just reuse it. |
| Captain sees stale data | Pull-to-refresh; the app auto-resyncs on reconnect. |
| Need a clean slate | Re-run `start-dev.bat` (reseeds a fresh tournament). |
| Login says "too many attempts" | The rate limiter tripped — wait one minute. |

---

## 10. Future plug-ins (already seamed in)

- **Automated stat import (OCR / tracker API):** the Stats import already routes
  through one parser (`server/src/analytics/statsParser.js`). An OCR step
  (screenshot → text) or a tracker-API pull just needs to produce the same rows
  and feed that same function — no other changes.
- **Self-registration** (players make their own accounts), **auto-bracket
  generation**, and a **cloud-hosted public hub** are natural next additions; the
  data models already support them.
