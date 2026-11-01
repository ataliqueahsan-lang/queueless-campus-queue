import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppUser } from '@/types';
import { repo } from '@/services/repo';

const Ctx = createContext<{ user: AppUser | null; loading: boolean }>({ user: null, loading: true });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: AppUser | null; loading: boolean }>({ user: null, loading: true });
  useEffect(() => repo.onAuth((user, loading) => setState({ user, loading })), []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
