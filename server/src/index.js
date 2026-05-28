import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketServer } from 'socket.io';

import { connectDB } from './config/db.js';
import { initAuctionEngine } from './auction/engine.js';
import authRoutes from './routes/auth.js';
import tournamentRoutes from './routes/tournament.js';
import matchdayRoutes from './routes/matchday.js';
import publicRoutes from './routes/public.js';
import playersRoutes from './routes/players.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();

// ---- Express setup --------------------------------------------------------
// On event day, captains connect from the host laptop's LAN IP (e.g.
// http://192.168.1.50:5173) - a different origin than localhost. By default we
// reflect the request origin so every device on the venue Wi-Fi is accepted.
// Set CLIENT_ORIGIN (comma-separated) only if you want to restrict it.
const corsOrigin = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
// Abuse guards: strict on login + register (brute-force), generous general cap.
app.use('/api/auth/login', rateLimit({ windowMs: 60000, max: 50, message: 'Too many login attempts — wait a minute.' }));
app.use('/api/auth/register', rateLimit({ windowMs: 60000, max: 20, message: 'Too many registrations — wait a minute.' }));
app.use('/api', rateLimit({ windowMs: 60000, max: 2000 }));

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api', matchdayRoutes); // matches, stats, poaching, analytics
app.use('/api', playersRoutes); // self-registration profiles + admin approval
app.use('/api/public', publicRoutes); // read-only spectator hub (no auth)

// ---- Serve the built client (production single-service / cloud) ------------
// In dev the client runs on Vite (:5173). In production we serve client/dist
// from here, so ONE service hosts the API, the live app, and the public hub.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next(); // let unknown API paths 404 as JSON
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log('[server] serving built client from', clientDist);
}

// ---- HTTP + Socket.io -----------------------------------------------------
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: corsOrigin, credentials: true },
});

// The auction engine attaches all its socket handlers here.
initAuctionEngine(io);

// ---- Boot -----------------------------------------------------------------
const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
    console.log(`[server] accepting client origin: ${process.env.CLIENT_ORIGIN || 'any (LAN)'}`);
  });
});
