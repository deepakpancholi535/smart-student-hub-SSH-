import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, json } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(credentials, register = false) {
    const { user: currentUser } = await api(`/auth/${register ? 'register' : 'login'}`, json('POST', credentials));
    setUser(currentUser);
  }

  async function signOut() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
