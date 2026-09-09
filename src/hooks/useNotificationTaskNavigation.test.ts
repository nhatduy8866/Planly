import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type * as Notifications from 'expo-notifications';

import { useNotificationTaskNavigation } from './useNotificationTaskNavigation';

const mockNavigate = jest.fn();
const mockRemove = jest.fn();
const mockClearLastResponse = jest.fn();
const mockGetLastResponse = jest.fn<() => Notifications.NotificationResponse | null>();
let mockResponseListener:
  | ((response: Notifications.NotificationResponse) => void)
  | undefined;

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'default',
  addNotificationResponseReceivedListener: jest.fn(
    (listener: (response: Notifications.NotificationResponse) => void) => {
      mockResponseListener = listener;
      return { remove: mockRemove };
    },
  ),
  clearLastNotificationResponse: () => mockClearLastResponse(),
  getLastNotificationResponse: () => mockGetLastResponse(),
}));

interface TestRendererInstance {
  unmount(): void;
  update(element: ReturnType<typeof createElement>): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

function notificationResponse(
  taskId: unknown,
  options: { actionIdentifier?: string; identifier?: string } = {},
): Notifications.NotificationResponse {
  return {
    actionIdentifier: options.actionIdentifier ?? 'default',
    notification: {
      date: Date.now(),
      request: {
        content: { data: { taskId } },
        identifier: options.identifier ?? 'notification-1',
        trigger: null,
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

describe('useNotificationTaskNavigation', () => {
  let tree: TestRendererInstance | undefined;
  let requestTask: jest.Mock<(taskId: string) => void>;

  function Harness({ ready = true }: { ready?: boolean }) {
    useNotificationTaskNavigation(requestTask, ready);
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponseListener = undefined;
    mockGetLastResponse.mockReturnValue(null);
    requestTask = jest.fn();
  });

  afterEach(() => {
    act(() => tree?.unmount());
  });

  it('handles a cold-start response and clears it after navigation', () => {
    mockGetLastResponse.mockReturnValue(
      notificationResponse('task-1', { identifier: 'cold-start-1' }),
    );

    act(() => {
      tree = create(createElement(Harness));
    });

    expect(requestTask).toHaveBeenCalledWith('task-1');
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockClearLastResponse).toHaveBeenCalledTimes(1);
  });

  it('handles a live tap only once for the same notification', () => {
    act(() => {
      tree = create(createElement(Harness));
    });

    const response = notificationResponse('task-2');
    act(() => {
      mockResponseListener?.(response);
      mockResponseListener?.(response);
    });

    expect(requestTask).toHaveBeenCalledTimes(1);
    expect(requestTask).toHaveBeenCalledWith('task-2');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('waits for the router and store to be ready during cold start', () => {
    mockGetLastResponse.mockReturnValue(
      notificationResponse('task-4', { identifier: 'cold-start-2' }),
    );
    act(() => {
      tree = create(createElement(Harness, { ready: false }));
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => {
      tree?.update(createElement(Harness, { ready: true }));
    });

    expect(requestTask).toHaveBeenCalledWith('task-4');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('ignores non-tap actions and malformed task IDs', () => {
    act(() => {
      tree = create(createElement(Harness));
    });

    act(() => {
      mockResponseListener?.(
        notificationResponse('task-3', { actionIdentifier: 'snooze' }),
      );
      mockResponseListener?.(
        notificationResponse('', { identifier: 'notification-2' }),
      );
    });

    expect(requestTask).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('removes the native listener on unmount', () => {
    act(() => {
      tree = create(createElement(Harness));
    });
    act(() => tree?.unmount());
    tree = undefined;

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
