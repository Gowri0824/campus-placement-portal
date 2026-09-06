import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAuthProfile,
  getCurrentSession,
  signInWithPassword,
  signOut as signOutSession,
  subscribeToAuthChanges,
} from "../services/authService";
import { AuthContext } from "./AuthContext";

const initialAuthState = {
  session: null,
  user: null,
  profile: null,
  role: "",
  isLoading: true,
  isAuthReady: false,
  error: null,
};

function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(initialAuthState);
  const isMountedRef = useRef(false);
  const syncVersionRef = useRef(0);

  const synchronizeSession = useCallback(async (session) => {
    const syncVersion = ++syncVersionRef.current;

    if (!session?.user) {
      if (isMountedRef.current && syncVersion === syncVersionRef.current) {
        setAuthState({
          ...initialAuthState,
          isLoading: false,
          isAuthReady: true,
        });
      }

      return { user: null, profile: null };
    }

    try {
      const profile = await getAuthProfile(session.user.id);

      if (isMountedRef.current && syncVersion === syncVersionRef.current) {
        setAuthState({
          session,
          user: session.user,
          profile,
          role: profile.role || "",
          isLoading: false,
          isAuthReady: true,
          error: null,
        });
      }

      return { user: session.user, profile };
    } catch (error) {
      if (isMountedRef.current && syncVersion === syncVersionRef.current) {
        setAuthState({
          session,
          user: session.user,
          profile: null,
          role: "",
          isLoading: false,
          isAuthReady: true,
          error,
        });
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    getCurrentSession()
      .then(synchronizeSession)
      .catch((error) => {
        if (isMountedRef.current) {
          setAuthState({
            ...initialAuthState,
            isLoading: false,
            isAuthReady: true,
            error,
          });
        }
      });

    const unsubscribe = subscribeToAuthChanges((_event, session) => {
      Promise.resolve()
        .then(() => synchronizeSession(session))
        .catch(() => {});
    });

    return () => {
      isMountedRef.current = false;
      syncVersionRef.current += 1;
      unsubscribe();
    };
  }, [synchronizeSession]);

  const signIn = useCallback(
    async (credentials) => {
      const data = await signInWithPassword(credentials);
      const authenticatedState = await synchronizeSession(data.session);

      return { ...data, ...authenticatedState };
    },
    [synchronizeSession]
  );

  const signOut = useCallback(async () => {
    await signOutSession();
    await synchronizeSession(null);
  }, [synchronizeSession]);

  const refreshProfile = useCallback(async () => {
    if (!authState.session) {
      return null;
    }

    return synchronizeSession(authState.session);
  }, [authState.session, synchronizeSession]);

  const contextValue = useMemo(
    () => ({
      ...authState,
      isAuthenticated: Boolean(authState.user),
      signIn,
      signOut,
      refreshProfile,
    }),
    [authState, refreshProfile, signIn, signOut]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export default AuthProvider;
