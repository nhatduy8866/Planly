import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { LocalDataCleanupHandler } from '../auth/AuthContext';
import type { Task } from '../types';
import { CloudSyncProvider } from './CloudSyncContext';

const mockDispatch = jest.fn();
const mockFetchCloudPlannerSnapshot = jest.fn();
const mockGetStorageItem = jest.fn<() => Promise<string | null>>();
const mockMergePlannerSnapshots = jest.fn();
const mockPersistTasks = jest.fn<(tasks: Task[]) => Promise<void>>();
const mockPushCloudPlannerMutations = jest.fn(async () => undefined);
const mockReadSyncOutbox = jest.fn(async () => []);
const mockRemoveProcessedSyncMutations = jest.fn(async () => []);
const mockResetPreferences = jest.fn(async () => undefined);
let mockRegisteredCleanup: LocalDataCleanupHandler | null = null;

const task: Task = {
  completed: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  date: '2026-09-27',
  description: '',
  id: 'task-a',
  order: 0,
  priority: 'medium',
  startTime: '09:00',
  title: 'Owner A task',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const mockTasks = [task];
const mockAuthValue: {
  configured: boolean;
  hydrated: boolean;
  registerLocalDataCleanup: (
    handler: LocalDataCleanupHandler,
  ) => () => void;
  user: { id: string } | null;
} = {
  configured: true,
  hydrated: true,
  registerLocalDataCleanup: (handler: LocalDataCleanupHandler) => {
    mockRegisteredCleanup = handler;
    return () => {
      if (mockRegisteredCleanup === handler) mockRegisteredCleanup = null;
    };
  },
  user: { id: 'user-a' },
};
const mockPreferencesValue = {
  language: 'vi' as const,
  resetPreferences: mockResetPreferences,
  theme: 'light' as const,
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: () => mockGetStorageItem(),
    setItem: jest.fn(async () => undefined),
  },
}));

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => mockPreferencesValue,
}));

jest.mock('../store/PlannerContext', () => ({
  usePersistPlannerTasks: () => mockPersistTasks,
  usePlannerDispatch: () => mockDispatch,
  usePlannerHydrated: () => true,
  usePlannerTasks: () => mockTasks,
}));

jest.mock('../services/localDataCleanup', () => ({
  clearLocalPlanlyData: jest.fn(async ({ persistTasks }) => {
    await persistTasks([]);
  }),
}));

jest.mock('../services/supabase', () => ({
  supabase: {},
}));

jest.mock('../services/sync/cloudPlanner', () => ({
  fetchCloudPlannerSnapshot: (...args: unknown[]) =>
    mockFetchCloudPlannerSnapshot(...args),
  pushCloudPlannerMutations: () => mockPushCloudPlannerMutations(),
}));

jest.mock('../services/sync/merge', () => ({
  diffPlannerData: jest.fn(() => []),
  mergePlannerSnapshots: (...args: unknown[]) =>
    mockMergePlannerSnapshots(...args),
}));

jest.mock('../services/sync/outbox', () => ({
  enqueueSyncMutations: jest.fn(),
  readSyncOutbox: () => mockReadSyncOutbox(),
  removeProcessedSyncMutations: () => mockRemoveProcessedSyncMutations(),
}));

jest.mock('../utils/taskEquality', () => ({
  haveSameTaskLists: jest.fn(() => false),
}));

interface TestRendererInstance {
  unmount(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('CloudSyncProvider owner transition gate', () => {
  let tree: TestRendererInstance | undefined;
  let resolveFetch!: (value: { tasks: [] }) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisteredCleanup = null;
    mockPersistTasks.mockResolvedValue(undefined);
    mockGetStorageItem.mockResolvedValue('user-a');
    mockAuthValue.user = { id: 'user-a' };
    mockMergePlannerSnapshots.mockReturnValue({
      consumedMutations: [],
      mutationsToPush: [],
      tasks: [{ ...task, id: 'restored-from-cloud' }],
    });
    mockFetchCloudPlannerSnapshot.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve;
    }));
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('does not restore an old cloud snapshot after sign-out cleanup starts', async () => {
    await act(async () => {
      tree = create(createElement(CloudSyncProvider, null));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchCloudPlannerSnapshot).toHaveBeenCalledTimes(1);
    expect(mockRegisteredCleanup).not.toBeNull();

    await act(async () => {
      await mockRegisteredCleanup?.('signOut');
    });
    expect(mockPersistTasks).toHaveBeenCalledWith([]);
    expect(mockDispatch).toHaveBeenCalledWith({
      payload: { tasks: [] },
      type: 'replace_from_sync',
    });

    await act(async () => {
      resolveFetch({ tasks: [] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockMergePlannerSnapshots).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('preserves signed-out local-only tasks when no cloud owner was recorded', async () => {
    mockAuthValue.user = null;
    mockGetStorageItem.mockResolvedValue(null);

    await act(async () => {
      tree = create(createElement(CloudSyncProvider, null));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPersistTasks).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockFetchCloudPlannerSnapshot).not.toHaveBeenCalled();
  });
});
