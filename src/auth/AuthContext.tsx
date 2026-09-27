import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  isSupabaseConfigured,
  supabase,
} from '../services/supabase';

export interface SignUpResult {
  needsEmailConfirmation: boolean;
}

export type LocalDataCleanupMode = 'signOut' | 'deleteAccount';
export type LocalDataCleanupHandler = (
  mode: LocalDataCleanupMode,
) => Promise<void>;

interface AuthContextValue {
  configured: boolean;
  deleteAccount: () => Promise<void>;
  hydrated: boolean;
  registerLocalDataCleanup: (
    handler: LocalDataCleanupHandler,
  ) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(!isSupabaseConfigured);
  const localDataCleanupRef = useRef<LocalDataCleanupHandler | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setHydrated(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
  ): Promise<SignUpResult> => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return { needsEmailConfirmation: data.session === null };
  }, []);

  const registerLocalDataCleanup = useCallback((
    handler: LocalDataCleanupHandler,
  ) => {
    localDataCleanupRef.current = handler;
    return () => {
      if (localDataCleanupRef.current === handler) {
        localDataCleanupRef.current = null;
      }
    };
  }, []);

  const cleanLocalData = useCallback(async (mode: LocalDataCleanupMode) => {
    const handler = localDataCleanupRef.current;
    if (!handler) {
      throw new Error('LOCAL_DATA_CLEANUP_UNAVAILABLE');
    }
    await handler(mode);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    let cleanupError: unknown;
    try {
      await cleanLocalData('signOut');
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.message === 'LOCAL_DATA_CLEANUP_UNAVAILABLE'
      ) throw caught;
      cleanupError = caught;
    }
    const { error } = await supabase.auth.signOut();
    if (cleanupError) throw cleanupError;
    if (error) throw error;
  }, [cleanLocalData]);

  const deleteAccount = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: true },
    });
    if (error) throw error;

    let cleanupError: unknown;
    try {
      await cleanLocalData('deleteAccount');
    } catch (caught) {
      cleanupError = caught;
    }

    // The remote account no longer exists. Gate account-owned UI even if the
    // local SDK cannot complete its final session cleanup.
    setUser(null);
    const { error: signOutError } = await supabase.auth.signOut({
      scope: 'local',
    });
    if (cleanupError) throw cleanupError;
    if (signOutError) throw signOutError;
  }, [cleanLocalData]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      deleteAccount,
      hydrated,
      registerLocalDataCleanup,
      signIn,
      signOut,
      signUp,
      user,
    }),
    [
      deleteAccount,
      hydrated,
      registerLocalDataCleanup,
      signIn,
      signOut,
      signUp,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
