import type { ReactNode } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

/**
 * Composes all app-level React context providers in the required dependency order:
 *
 *   AuthProvider        — must wrap all authenticated UI
 *     ThemeProvider     — reads user theme preference (may depend on auth state)
 *
 * If you add a new provider, document its position and reason here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}
