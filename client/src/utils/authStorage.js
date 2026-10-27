// The JWT lives in localStorage. This module is the only code that touches
// it, and it notifies subscribers (AuthContext) on every change, including
// changes made in other tabs, so logging out in one tab logs out all of them.
const TOKEN_KEY = 'punebuzz.token';

const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage blocked (private mode, disabled cookies)
  }
}

let token = read();

function emit(reason) {
  for (const listener of listeners) listener(reason);
}

export function getToken() {
  return token;
}

export function setToken(value) {
  token = value;
  try {
    localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Still works for this tab, just won't survive a reload.
  }
  emit('login');
}

// reason: 'logout' (user clicked) or 'expired' (the API rejected the token)
export function clearToken(reason = 'logout') {
  if (token === null) return;
  token = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  emit(reason);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

window.addEventListener('storage', (event) => {
  if (event.key !== TOKEN_KEY) return;
  token = event.newValue;
  emit(token ? 'login' : 'logout');
});
