import { useEffect, useRef, useState, useCallback } from 'react';
import { createSocket } from './socket.js';
import { useAuth } from './auth.jsx';

/**
 * The single client-side mirror of the server's auction state. Connects an
 * authenticated socket, joins the tournament room, and keeps the latest
 * snapshot. The server is the source of truth — this hook never computes
 * auction outcomes, it only renders what the server sends and forwards actions.
 *
 * On (re)connect it re-joins automatically, so a phone that drops Wi-Fi
 * resyncs the moment it comes back.
 */
export function useAuction(tournamentId) {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0); // clientNow - serverNow
  const [events, setEvents] = useState([]); // transient feed (bids/sales)

  const pushEvent = useCallback((e) => {
    setEvents((prev) => [{ id: Date.now() + Math.random(), ...e }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    if (!token || !tournamentId) return undefined;
    const socket = createSocket(token);
    socketRef.current = socket;

    const join = () => socket.emit('join', { tournamentId });

    socket.on('connect', () => {
      setConnected(true);
      join(); // also fires on every reconnect → automatic resync
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('state', (snap) => {
      if (snap?.serverTime) setClockOffset(Date.now() - snap.serverTime);
      setState(snap);
    });
    socket.on('bidPlaced', (e) => pushEvent({ type: 'bid', ...e }));
    socket.on('playerSold', (e) => pushEvent({ type: 'sold', ...e }));
    socket.on('playerUnsold', (e) => pushEvent({ type: 'unsold', ...e }));

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [token, tournamentId, pushEvent]);

  // Emit an event and resolve with the server's ack.
  const emit = useCallback(
    (event, payload = {}) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ error: 'Not connected' });
        socket.emit(event, payload, (ack) => resolve(ack || {}));
      }),
    []
  );

  const actions = {
    bid: (amount) => emit('bid', { amount }),
    selectPlayer: (pass = 1) => emit('selectPlayer', { pass }),
    startAuction: () => emit('startAuction'),
    hammer: () => emit('hammer'),
    pause: () => emit('pause'),
    resume: () => emit('resume'),
    undoLastSale: () => emit('undoLastSale'),
  };

  return { state, connected, clockOffset, events, actions };
}

export default useAuction;
