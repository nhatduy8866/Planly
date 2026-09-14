import {
  FlexWidget,
  TextWidget,
  type WidgetInfo,
  type WidgetRepresentation,
} from 'react-native-android-widget';

import type { TodayWidgetSnapshot, TodayWidgetTask } from './todayWidgetData';
import {
  TODAY_WIDGET_COMPLETE_ACTION,
  TODAY_WIDGET_UNDO_ACTION,
  TODAY_WIDGET_URI,
} from './todayWidgetData';

interface AndroidWidgetPalette {
  accent: `#${string}`;
  completed: `#${string}`;
  divider: `#${string}`;
  header: `#${string}`;
  headerText: `#${string}`;
  surface: `#${string}`;
  text: `#${string}`;
  textMuted: `#${string}`;
}

const LIGHT_PALETTE: AndroidWidgetPalette = {
  accent: '#4F46E5',
  completed: '#94A3B8',
  divider: '#C7D2FE',
  header: '#4F46E5',
  headerText: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
};

const DARK_PALETTE: AndroidWidgetPalette = {
  accent: '#818CF8',
  completed: '#94A3B8',
  divider: '#475569',
  header: '#6366F1',
  headerText: '#FFFFFF',
  surface: '#1E293B',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
};

function taskTitle(task: TodayWidgetTask, widgetWidth: number): string {
  const maxLength = widgetWidth >= 320 ? 34 : 24;
  if (task.title.length <= maxLength) return task.title;
  return `${task.title.slice(0, maxLength - 1).trimEnd()}…`;
}

function AndroidTodayWidget({
  palette,
  snapshot,
  widgetInfo,
}: {
  palette: AndroidWidgetPalette;
  snapshot: TodayWidgetSnapshot;
  widgetInfo: WidgetInfo;
}) {
  const visibleTasks = snapshot.tasks;

  return (
    <FlexWidget
      accessibilityLabel={`${snapshot.todayLabel}, ${snapshot.dateLabel}`}
      clickAction="OPEN_URI"
      clickActionData={{ uri: TODAY_WIDGET_URI }}
      style={{
        flexDirection: 'column',
        height: 'match_parent',
        padding: 5,
        width: 'match_parent',
      }}
    >
      <FlexWidget
        style={{
          backgroundColor: palette.header,
          borderTopLeftRadius: 9,
          borderTopRightRadius: 9,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 3,
          width: 108,
        }}
      >
        <TextWidget
          text="Planly"
          style={{
            color: palette.headerText,
            fontSize: 13,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {visibleTasks.length === 0 ? (
        <FlexWidget
          style={{
            alignItems: 'center',
            backgroundColor: palette.surface,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            borderColor: palette.header,
            borderTopRightRadius: 10,
            borderWidth: 2,
            flex: 1,
            justifyContent: 'center',
            width: 'match_parent',
          }}
        >
          <TextWidget
            text={snapshot.emptyLabel}
            style={{ color: palette.textMuted, fontSize: 11 }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            backgroundColor: palette.surface,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            borderColor: palette.header,
            borderTopRightRadius: 10,
            borderWidth: 2,
            flex: 1,
            flexDirection: 'column',
            width: 'match_parent',
          }}
        >
          {visibleTasks.map((task, index) => {
            const isCompletionPending = snapshot.pendingCompletions.some(
              (completion) => completion.taskId === task.id,
            );
            const isCompleted = task.completed || isCompletionPending;

            return (
              <FlexWidget
                key={task.id}
                style={{
                  alignItems: 'center',
                  borderTopColor: palette.divider,
                  borderTopWidth: index === 0 ? 0 : 1,
                  flex: 1,
                  flexDirection: 'row',
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  width: 'match_parent',
                }}
              >
                <FlexWidget
                  accessibilityLabel={
                    isCompletionPending
                      ? snapshot.language === 'vi'
                        ? `Hoàn tác hoàn thành ${task.title}`
                        : `Undo completing ${task.title}`
                      : snapshot.language === 'vi'
                        ? `Đánh dấu ${task.title} đã hoàn thành`
                        : `Mark ${task.title} as completed`
                  }
                  clickAction={
                    isCompletionPending
                      ? TODAY_WIDGET_UNDO_ACTION
                      : TODAY_WIDGET_COMPLETE_ACTION
                  }
                  clickActionData={{ taskId: task.id }}
                  style={{
                    alignItems: 'center',
                    height: 'match_parent',
                    justifyContent: 'center',
                    marginRight: 7,
                    width: 36,
                  }}
                >
                  <TextWidget
                    style={{
                      color: isCompleted ? palette.completed : task.color,
                      fontSize: isCompleted ? 24 : 28,
                      textAlign: 'center',
                      width: 36,
                    }}
                    text={isCompleted ? '✓' : '○'}
                  />
                </FlexWidget>
                {isCompletionPending ? (
                  <FlexWidget
                    accessibilityLabel={
                      snapshot.language === 'vi'
                        ? `Hoàn tác hoàn thành ${task.title}`
                        : `Undo completing ${task.title}`
                    }
                    clickAction={TODAY_WIDGET_UNDO_ACTION}
                    clickActionData={{ taskId: task.id }}
                    style={{
                      alignItems: 'center',
                      flex: 1,
                      height: 'match_parent',
                      justifyContent: 'center',
                      width: 'match_parent',
                    }}
                  >
                    <TextWidget
                      maxLines={1}
                      text={snapshot.undoLabel}
                      truncate="END"
                      style={{
                        color: palette.accent,
                        fontSize: 16,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        width: 'match_parent',
                      }}
                    />
                  </FlexWidget>
                ) : (
                  <FlexWidget
                    style={{
                      flex: 1,
                      flexDirection: 'column',
                    }}
                  >
                    <TextWidget
                      text={task.startTime}
                      style={{
                        color: palette.accent,
                        fontSize: 14,
                        fontWeight: 'bold',
                      }}
                    />
                    <TextWidget
                      maxLines={1}
                      text={taskTitle(task, widgetInfo.width)}
                      truncate="END"
                      style={{
                        color: palette.text,
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 1,
                      }}
                    />
                  </FlexWidget>
                )}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

export function renderAndroidTodayWidget(
  snapshot: TodayWidgetSnapshot,
  widgetInfo: WidgetInfo,
): WidgetRepresentation {
  const palette = snapshot.theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const widget = (
    <AndroidTodayWidget
      palette={palette}
      snapshot={snapshot}
      widgetInfo={widgetInfo}
    />
  );

  return {
    dark: widget,
    light: widget,
  };
}
