import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme, subscribeTheme } from '../utils/theme';

// Sun/moon button in the navbar. Follows the system until clicked once.
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
