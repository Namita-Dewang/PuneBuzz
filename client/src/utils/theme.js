// Light/dark theme. An explicit choice is saved in localStorage; with no
// choice saved we follow the operating system (and keep following it if it
// changes). index.html applies the same logic before first paint.
const KEY = 'punebuzz.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

function saved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function getTheme() {
  return saved() ?? (media.matches ? 'dark' : 'light');
}

function apply() {
  document.documentElement.classList.toggle('dark', getTheme() === 'dark');
  listeners.forEach((listener) => listener());
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: still switch for this page view.
    document.documentElement.classList.toggle('dark', theme === 'dark');
    listeners.forEach((listener) => listener());
    return;
  }
  apply();
}

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

media.addEventListener('change', () => {
  if (!saved()) apply();
});

window.addEventListener('storage', (event) => {
  if (event.key === KEY) apply();
});
