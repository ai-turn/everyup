import type { ReactNode } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { TooltipProvider } from './common/Tooltip';

/**
 * Composes all app-level React context providers in the required dependency order:
 *
 *   AuthProvider        — must wrap all authenticated UI
 *     ThemeProvider     — reads user theme preference (may depend on auth state)
 *       TooltipProvider — shares the hint delay across controls
 *
 * If you add a new provider, document its position and reason here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
