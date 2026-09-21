import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { TASK_COMPLETE_ACTION_IDENTIFIER } from '../services/notifications';

function taskIdFromResponse(
  response: Notifications.NotificationResponse,
): string | undefined {
  if (
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER &&
    response.actionIdentifier !== TASK_COMPLETE_ACTION_IDENTIFIER
  ) {
    return undefined;
  }

  const taskId = response.notification.request.content.data?.taskId;
  return typeof taskId === 'string' && taskId.trim() ? taskId : undefined;
}

export function useNotificationTaskNavigation(
  requestTask: (taskId: string) => void,
  ready: boolean,
  completeTask?: (taskId: string) => void | Promise<void>,
): void {
  const router = useRouter();
  const handledNotificationIdsRef = useRef(new Set<string>());
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(
    null,
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const processResponse = async (
      response: Notifications.NotificationResponse,
    ) => {
      const notificationId = response.notification.request.identifier;
      const responseKey = `${notificationId}:${response.actionIdentifier}`;
      if (handledNotificationIdsRef.current.has(responseKey)) return;

      const taskId = taskIdFromResponse(response);
      if (!taskId) return;

      handledNotificationIdsRef.current.add(responseKey);
      try {
        if (response.actionIdentifier === TASK_COMPLETE_ACTION_IDENTIFIER) {
          await completeTask?.(taskId);
        } else {
          requestTask(taskId);
          router.navigate('/');
        }
        Notifications.clearLastNotificationResponse();
      } catch {
        // A later reconciliation can retry reminder cleanup if needed.
      }
    };

    const handleResponse = (response: Notifications.NotificationResponse) => {
      if (!ready) {
        pendingResponseRef.current = response;
        return;
      }
      void processResponse(response);
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    if (ready && pendingResponseRef.current) {
      const pendingResponse = pendingResponseRef.current;
      pendingResponseRef.current = null;
      void processResponse(pendingResponse);
    }
    const coldStartResponse = Notifications.getLastNotificationResponse();
    if (coldStartResponse) handleResponse(coldStartResponse);

    return () => subscription.remove();
  }, [completeTask, ready, requestTask, router]);
}
