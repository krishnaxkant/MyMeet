import { useTheme } from '../hooks/useTheme';
import { MoonIcon, SunIcon } from './Icons';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
      >
        <SunIcon />
        <span>Light</span>
      </button>
      <button
        type="button"
        className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
      >
        <MoonIcon />
        <span>Dark</span>
      </button>
    </div>
  );
}
