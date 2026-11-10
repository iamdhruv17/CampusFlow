import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/auth.service';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; authService.me().then(({ data }) => { if (active) setUser(data.user); }).catch(() => { if (active) setUser(null); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const login = async (values) => { const { data } = await authService.login(values); setUser(data.user); return data.user; };
  const register = async (values) => { const { data } = await authService.register(values); setUser(data.user); return data.user; };
  const logout = async () => { try { await authService.logout(); } finally { setUser(null); } };
  const refreshUser = async () => { const { data } = await authService.me(); setUser(data.user); return data.user; };
  const value = useMemo(() => ({ user, loading, login, register, logout, refreshUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
