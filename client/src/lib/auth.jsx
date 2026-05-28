import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

/**
 * Auth context. The login token is kept in localStorage (works cleanly across
 * devices on the LAN, where httpOnly cookies are awkward) and sent as a Bearer
 * header / socket handshake token. On boot we restore the session via /me.
 */
const AuthContext = createContext(null);
const STORAGE_KEY = 'ntg.auth';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then((d) => !cancelled && setAccount(d.account))
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setAccount(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (username, password) => {
    const { account: acc, token: tok } = await api.login(username, password);
    localStorage.setItem(STORAGE_KEY, tok);
    setToken(tok);
    setAccount(acc);
    return acc;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setAccount(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, account, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
