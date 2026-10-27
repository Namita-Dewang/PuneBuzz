import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import { clearToken, getToken, setToken, subscribe } from '../utils/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(subscribe, getToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Any logout (button, expired token, another tab) wipes cached data so the
  // next user never sees the previous user's RSVP statuses. A login refetches
  // everything, since data fetched while logged out has myStatus: null.
  useEffect(
    () =>
      subscribe((reason) => {
        setSessionExpired(reason === 'expired');
        if (reason === 'login') {
          queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
        } else {
          queryClient.clear();
        }
      }),
    [queryClient]
  );

  // Keyed by token so a login in another tab fetches the right user.
  const meQuery = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: authApi.fetchMe,
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: false,
  });

  const acceptSession = useCallback(
    ({ user, token: newToken }) => {
      // Cache the user first so there's no loading flash when the token flips.
      queryClient.setQueryData(['auth', 'me', newToken], user);
      setToken(newToken);
      return user;
    },
    [queryClient]
  );

  const login = useCallback(async (credentials) => acceptSession(await authApi.login(credentials)), [acceptSession]);
  const register = useCallback(async (details) => acceptSession(await authApi.register(details)), [acceptSession]);
  const logout = useCallback(() => clearToken('logout'), []);

  const value = useMemo(() => {
    const user = token ? (meQuery.data ?? null) : null;
    return {
      user,
      isAuthenticated: Boolean(user),
      // True only while we have a token but haven't loaded the user yet.
      isLoading: Boolean(token) && meQuery.isPending,
      sessionExpired,
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
      // Mirrors canManage() on the server: the event's organizer or an admin.
      canManage: (event) => Boolean(user && event && (user.role === 'admin' || event.organizer?.id === user.id)),
      login,
      register,
      logout,
    };
  }, [token, meQuery.data, meQuery.isPending, sessionExpired, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
