import { io } from 'socket.io-client';
import { API_BASE } from './api.js';

/**
 * Creates an authenticated socket to the auction server. The token is passed
 * in the handshake auth (the server verifies it there). Auto-reconnect is on
 * by default in socket.io; on reconnect the caller re-joins and resyncs.
 */
export function createSocket(token) {
  return io(API_BASE || undefined, { // '' → same-origin (production single-service)
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
}
