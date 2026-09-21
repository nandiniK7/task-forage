import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/services";
import { AUTH_EXPIRED_EVENT, isCancelled, tokenStore } from "../api/client";
import { AuthContext } from "./contexts";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(() => Boolean(tokenStore.get()));
  const [sessionExpired, setSessionExpired] = useState(false);

  // Restore the session from the stored token.
  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    const controller = new AbortController();
    authApi
      .me(controller.signal)
      .then(({ user: current }) => setUser(current))
      .catch((error) => {
        if (isCancelled(error)) return;
        // A 401 already cleared the token; for other failures (server down) stay signed out but keep the token.
        setUser(null);
      })
      .finally(() => { if (!controller.signal.aborted) setInitializing(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const startSession = useCallback(({ token, user: nextUser }) => {
    tokenStore.set(token);
    setSessionExpired(false);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(async (credentials) => startSession(await authApi.login(credentials)), [startSession]);
  const register = useCallback(async (details) => startSession(await authApi.register(details)), [startSession]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, initializing, sessionExpired, login, register, logout }),
    [user, initializing, sessionExpired, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
