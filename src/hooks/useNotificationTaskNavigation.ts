import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

function taskIdFromResponse(
  response: Notifications.NotificationResponse,
): string | undefined {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    return undefined;
  }

  const taskId = response.notification.request.content.data?.taskId;
  return typeof taskId === 'string' && taskId.trim() ? taskId : undefined;
}

export function useNotificationTaskNavigation(
  requestTask: (taskId: string) => void,
  ready: boolean,
): void {
  const router = useRouter();
  const handledNotificationIdsRef = useRef(new Set<string>());
  const pendingResponseRef = useRef<Notifications.NotificationResponse | null>(
    null,
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const processResponse = (response: Notifications.NotificationResponse) => {
      const notificationId = response.notification.request.identifier;
      if (handledNotificationIdsRef.current.has(notificationId)) return;

      const taskId = taskIdFromResponse(response);
      if (!taskId) return;

      handledNotificationIdsRef.current.add(notificationId);
      requestTask(taskId);
      router.navigate('/');
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // Navigation already succeeded; stale-response cleanup is best effort.
      }
    };

    const handleResponse = (response: Notifications.NotificationResponse) => {
      if (!ready) {
        pendingResponseRef.current = response;
        return;
      }
      processResponse(response);
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    if (ready && pendingResponseRef.current) {
      const pendingResponse = pendingResponseRef.current;
      pendingResponseRef.current = null;
      processResponse(pendingResponse);
    }
    const coldStartResponse = Notifications.getLastNotificationResponse();
    if (coldStartResponse) handleResponse(coldStartResponse);

    return () => subscription.remove();
  }, [ready, requestTask, router]);
}
