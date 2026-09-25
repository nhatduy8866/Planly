import { requireOptionalNativeModule } from 'expo';

interface PlanlyWidgetRefreshModule {
  scheduleRefresh(timestampMs?: number): Promise<void>;
}

const widgetRefreshModule =
  requireOptionalNativeModule<PlanlyWidgetRefreshModule>(
    'PlanlyWidgetRefresh',
  );

export async function scheduleTodayWidgetRefresh(
  timestampMs?: number,
): Promise<void> {
  await widgetRefreshModule?.scheduleRefresh(timestampMs);
}
