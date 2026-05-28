/**
 * REST helpers. The API base defaults to the same host the page is served
 * from, on port 4000 — so a phone hitting http://<laptop-ip>:5173 will call
 * http://<laptop-ip>:4000 automatically on the venue Wi-Fi. Override with
 * VITE_API_BASE if the server runs elsewhere (e.g. a cloud deployment).
 */
// In `vite dev` (any port) talk to the backend on :4000 of the same host.
// In production (`vite build` → served by the API server) use the same origin.
// Override anytime with VITE_API_BASE.
export const API_BASE = import.meta.env.VITE_API_BASE
  || (import.meta.env.DEV ? `http://${window.location.hostname}:4000` : '');

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  // auth + tournament
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  me: (token) => request('/api/auth/me', { token }),
  tournaments: (token) => request('/api/tournaments', { token }),
  tournament: (id, token) => request(`/api/tournaments/${id}`, { token }),
  updateEconomy: (tid, body, token) => request(`/api/tournaments/${tid}/economy`, { method: 'PATCH', body, token }),

  // self-registration
  openRegistration: () => request('/api/public/registration/open'),
  myProfile: (token) => request('/api/players/me', { token }),
  updateProfile: (body, token) => request('/api/players/me', { method: 'PATCH', body, token }),
  registrations: (tid, token) => request(`/api/tournaments/${tid}/registrations`, { token }),
  approvePlayer: (id, body, token) => request(`/api/players/${id}/approve`, { method: 'PATCH', body, token }),
  setRegistration: (tid, body, token) => request(`/api/tournaments/${tid}/registration`, { method: 'PATCH', body, token }),

  // matches (Module B)
  matches: (tid, token) => request(`/api/tournaments/${tid}/matches`, { token }),
  createMatch: (tid, body, token) => request(`/api/tournaments/${tid}/matches`, { method: 'POST', body, token }),
  updateMatch: (mid, body, token) => request(`/api/matches/${mid}`, { method: 'PATCH', body, token }),
  deleteMatch: (mid, token) => request(`/api/matches/${mid}`, { method: 'DELETE', token }),
  poach: (tid, body, token) => request(`/api/tournaments/${tid}/poach`, { method: 'POST', body, token }),

  // stats (Module C)
  matchStats: (mid, token) => request(`/api/matches/${mid}/stats`, { token }),
  saveStats: (mid, lines, token) => request(`/api/matches/${mid}/stats`, { method: 'POST', body: { lines }, token }),
  parseStats: (mid, text, token) => request(`/api/matches/${mid}/stats/parse`, { method: 'POST', body: { text }, token }),

  // analytics (Module D)
  analytics: (tid, token) => request(`/api/tournaments/${tid}/analytics`, { token }),

  // public hub (no auth)
  publicHub: (tid) => request(`/api/public/${tid}`),
  latest: () => request('/api/public/'),
};

export default api;
