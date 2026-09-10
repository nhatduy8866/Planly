import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function getClockRefreshDelay(now: Date, minuteSensitive: boolean): number {
  if (minuteSensitive) {
    return 60_000 - (now.getSeconds() * 1_000 + now.getMilliseconds());
  }

  const nextDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return nextDay.getTime() - now.getTime();
}

export function useMinuteClock(
  minuteSensitive: boolean,
): readonly [Date, () => void] {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const refresh = useCallback(() => setCurrentTime(new Date()), []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const scheduleNextRefresh = () => {
      if (!active) return;
      const now = new Date();
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        refresh();
        scheduleNextRefresh();
      }, getClockRefreshDelay(now, minuteSensitive));
    };

    const resetSchedule = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      scheduleNextRefresh();
    };

    scheduleNextRefresh();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refresh();
        resetSchedule();
      } else if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    });

    return () => {
      active = false;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [minuteSensitive, refresh]);

  return [currentTime, refresh] as const;
}
