import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthProvider, useAuth } from './AuthContext';

const mockGetSession = jest.fn<() => Promise<{
  data: { session: { user: Record<string, unknown> } | null };
}>>();
const mockInvoke = jest.fn<(...args: unknown[]) => Promise<{
  error: Error | null;
}>>();
const mockSignOut = jest.fn<(...args: unknown[]) => Promise<{
  error: Error | null;
}>>();
const mockUnsubscribe = jest.fn();

jest.mock('../services/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })),
      signInWithPassword: jest.fn(),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signUp: jest.fn(),
    },
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

interface TestRendererInstance {
  unmount(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('AuthProvider local cleanup boundary', () => {
  let auth!: ReturnType<typeof useAuth>;
  let tree: TestRendererInstance | undefined;

  function Harness() {
    auth = useAuth();
    return null;
  }

  async function renderProvider(user: Record<string, unknown> | null = null) {
    mockGetSession.mockResolvedValue({
      data: { session: user ? { user } : null },
    });
    await act(async () => {
      tree = create(
        createElement(AuthProvider, null, createElement(Harness)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({ error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('durably cleans local account data before asking Supabase to sign out', async () => {
    await renderProvider({ id: 'user-a' });
    const cleanup = jest.fn(async () => undefined);
    act(() => {
      auth.registerLocalDataCleanup(cleanup);
    });

    await act(async () => {
      await auth.signOut();
    });

    expect(cleanup).toHaveBeenCalledWith('signOut');
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it('does not contact Supabase when no cleanup boundary is registered', async () => {
    await renderProvider({ id: 'user-a' });

    await expect(auth.signOut()).rejects.toThrow(
      'LOCAL_DATA_CLEANUP_UNAVAILABLE',
    );
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('finishes remote sign-out after an attempted storage cleanup', async () => {
    await renderProvider({ id: 'user-a' });
    const cleanupError = new Error('storage unavailable');
    act(() => {
      auth.registerLocalDataCleanup(async () => {
        throw cleanupError;
      });
    });

    await expect(auth.signOut()).rejects.toBe(cleanupError);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('gates a remotely deleted account even if final local cleanup fails', async () => {
    await renderProvider({ id: 'user-a' });
    const cleanupError = new Error('storage unavailable');
    act(() => {
      auth.registerLocalDataCleanup(async () => {
        throw cleanupError;
      });
    });
    mockSignOut.mockResolvedValue({ error: new Error('session unavailable') });

    await act(async () => {
      await expect(auth.deleteAccount()).rejects.toBe(cleanupError);
    });

    expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
      body: { confirm: true },
    });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.user).toBeNull();
  });
});
