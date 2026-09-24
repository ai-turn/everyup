import { useTheme } from '../../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { IconButton, MaterialIcon } from '../common';
import { OPEN_PALETTE_EVENT } from './CommandPalette';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const isMobile = useIsMobile();
    const location = useLocation();

    const isAlertsActive = location.pathname.startsWith('/alerts');
    const isSettingsActive = location.pathname.startsWith('/settings');

    const iconLinkCls = (active: boolean) =>
        `w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            active
                ? 'text-primary bg-primary/10'
                : 'text-text-muted hover:bg-ui-hover hover:text-text-base'
        }`;

    return (
        <header className="h-14 lg:h-16 border-b border-ui-border bg-bg-surface shrink-0 transition-colors duration-200 z-30 relative">
          <div className="h-full max-w-320 mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Left: Logo */}
            <Link to="/" className="flex items-center gap-2 group shrink-0 z-10 transition-transform active:scale-95">
                <div className="flex items-center justify-center h-12 w-12 overflow-hidden">
                    <img src={theme === 'dark' ? logoDark : logo} alt="Monitoring Logo" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-text-base tracking-tight leading-none group-hover:text-primary transition-colors">EveryUp</h1>
                </div>
            </Link>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 lg:gap-3 z-10 shrink-0">
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
                    aria-label="Search"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-ui-hover hover:text-text-base"
                >
                    <MaterialIcon size={20} name="search" />
                </button>
                {/* Icon buttons */}
                <div className="flex items-center gap-1">
                    {!isMobile && (
                        <IconButton icon={theme === 'light' ? 'dark_mode' : 'light_mode'} label="테마 전환" tone="quiet" onClick={toggleTheme} />
                    )}
                    {!isMobile && (
                        <>
                            <Link to="/alerts" aria-label="Alerts" className={iconLinkCls(isAlertsActive)}>
                                <MaterialIcon size={20} name="notifications" />
                            </Link>
                            <Link to="/settings" aria-label="Settings" className={iconLinkCls(isSettingsActive)}>
                                <MaterialIcon size={20} name="settings" />
                            </Link>
                        </>
                    )}
                </div>
            </div>
          </div>
        </header>
    );
}
