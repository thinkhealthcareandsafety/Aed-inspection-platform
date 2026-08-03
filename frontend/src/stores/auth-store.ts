import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthStore {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('aed_token', token);
        set({ token, user });
      },
      clearAuth: () => {
        localStorage.removeItem('aed_token');
        set({ token: null, user: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'aed-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
