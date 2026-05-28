# NTG Tournament Platform — Server

Backend for the NTG Tournament Platform. Node.js + Express + MongoDB + Socket.io.

## Build status (Block 1, increment 1)

Done in this increment — the **auction backend foundation**:

- Project structure, dependencies, config
- All data models (game-agnostic): Tournament, GameTemplate, Player, Team,
  AuctionState, Account, plus the Block 2 match models
- JWT auth with four privilege levels (admin / auctioneer / captain / player)
- **The auction engine** — state machine, server-owned countdown timer,
  atomic bid handling, dynamic reserve rule, pause/resume, undo-last-sale,
  random draw, pass-2 unsold re-auction, boot-time timer recovery
- Auth + tournament REST routes
- Unit tests for the bid/reserve logic — all passing

Not yet built (next increments): the seed script (waiting on the 50-player
list), the three frontend terminals, and the Block 2 match-day modules.

## Setup

1. Install MongoDB locally, or create a free MongoDB Atlas cluster.
2. `cd server && npm install`
3. `cp .env.example .env` and fill in the values.
4. `npm start` (or `npm run dev` to auto-restart on changes).
5. Health check: open `http://localhost:4000/api/health`.

## How the auction engine works

- **Server is the single source of truth.** Clients only render state.
- **The timer lives on the server.** Every client renders a countdown from
  one `timerEndsAt` timestamp, so all screens match. The server alone decides
  when a player is sold.
- **Bids are atomic.** Two bids at the same instant cannot corrupt the price:
  a conditional update means one wins and the other is told to re-bid.
- **The reserve rule is dynamic.** A team can never overspend and be left
  unable to fill its roster; the safe-maximum recalculates as the cheapest
  available player changes.
- **Crash-safe.** Auction state is persisted; on restart the engine resumes
  any running timer from where it left off.

## Socket events

Client → server: `join`, `bid` (captain), `selectPlayer` / `startAuction` /
`hammer` / `pause` / `resume` / `undoLastSale` (auctioneer), `resync`.

Server → clients: `state` (full snapshot), `bidPlaced`, `playerSold`,
`playerUnsold`.
