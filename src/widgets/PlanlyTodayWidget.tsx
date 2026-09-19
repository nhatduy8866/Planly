import { Button, Divider, HStack, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  strokeBorder,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { scaleFontSize } from '../theme/typography';
import type { TodayWidgetSnapshot } from './todayWidgetData';
import {
  completeTodayWidgetSnapshot,
  TODAY_WIDGET_COMPLETE_ACTION,
  TODAY_WIDGET_UNDO_ACTION,
  undoTodayWidgetSnapshotCompletion,
} from './todayWidgetData';

function PlanlyTodayWidgetView(
  props: TodayWidgetSnapshot,
  environment: WidgetEnvironment,
) {
  'widget';

  const isDarkTheme = props.theme === 'dark';
  const surfaceColor = isDarkTheme ? '#1E293B' : '#FFFFFF';
  const primaryColor = isDarkTheme ? '#6366F1' : '#4F46E5';
  const textColor = isDarkTheme ? '#F8FAFC' : '#0F172A';
  const mutedColor = isDarkTheme ? '#CBD5E1' : '#64748B';
  const headerTextColor = '#FFFFFF';
  const completedColor = '#94A3B8';
  const accentColor = isDarkTheme ? '#818CF8' : '#4F46E5';
  const dividerColor = isDarkTheme ? '#475569' : '#C7D2FE';
  const visibleTasks = props.tasks;

  return (
    <VStack
      alignment="leading"
      spacing={3}
      modifiers={[
        frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }),
        padding({ all: 6 }),
        containerBackground('#00000000', 'widget'),
        widgetURL('planly:///'),
      ]}
    >
      <HStack
        alignment="center"
        modifiers={[
          frame({ width: 108, alignment: 'leading' }),
          padding({ horizontal: 8, vertical: 4 }),
          background(primaryColor, shapes.roundedRectangle({ cornerRadius: 9 })),
        ]}
      >
        <Text
          modifiers={[
            font({ size: scaleFontSize(13), weight: 'bold', design: 'rounded' }),
            foregroundStyle(headerTextColor),
          ]}
        >
          Planly
        </Text>
      </HStack>

      {visibleTasks.length === 0 ? (
        <VStack
          alignment="center"
          modifiers={[
            frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'center' }),
            background(
              surfaceColor,
              shapes.roundedRectangle({ cornerRadius: 10 }),
            ),
            strokeBorder({
              content: primaryColor,
              cornerRadius: 10,
              shape: 'roundedRectangle',
              style: { lineWidth: 2 },
            }),
          ]}
        >
          <Text
            modifiers={[
              font({ size: scaleFontSize(12) }),
              foregroundStyle(mutedColor),
              lineLimit(2),
            ]}
          >
            {props.emptyLabel}
          </Text>
        </VStack>
      ) : (
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[
            frame({ maxWidth: 1000, maxHeight: 1000, alignment: 'topLeading' }),
            background(
              surfaceColor,
              shapes.roundedRectangle({ cornerRadius: 10 }),
            ),
            strokeBorder({
              content: primaryColor,
              cornerRadius: 10,
              shape: 'roundedRectangle',
              style: { lineWidth: 2 },
            }),
          ]}
        >
          {visibleTasks.map((task, index) => {
            const isCompletionPending = (props.pendingCompletions ?? []).some(
              (completion) => completion.taskId === task.id,
            );
            const isCompleted = task.completed || isCompletionPending;

            return (
              <VStack
                key={task.id}
                alignment="leading"
                spacing={0}
                modifiers={[frame({ maxWidth: 1000, maxHeight: 1000 })]}
              >
                {index > 0 ? (
                  <Divider modifiers={[foregroundStyle(dividerColor)]} />
                ) : null}
                <HStack
                  alignment="center"
                  spacing={7}
                  modifiers={[
                    frame({
                      maxWidth: 1000,
                      maxHeight: 1000,
                      alignment: 'leading',
                    }),
                    padding({ horizontal: 9, vertical: 3 }),
                  ]}
                >
                  <Button
                    target={`${
                      isCompletionPending
                        ? TODAY_WIDGET_UNDO_ACTION
                        : TODAY_WIDGET_COMPLETE_ACTION
                    }:${task.id}`}
                    onPress={() =>
                      isCompletionPending
                        ? undoTodayWidgetSnapshotCompletion(props, task.id)
                        : completeTodayWidgetSnapshot(
                            props,
                            task.id,
                            new Date().toISOString(),
                          )
                    }
                    modifiers={[
                      buttonStyle('plain'),
                      accessibilityLabel(
                        isCompletionPending
                          ? props.language === 'vi'
                            ? `Hoàn tác hoàn thành ${task.title}`
                            : `Undo completing ${task.title}`
                          : props.language === 'vi'
                            ? `Đánh dấu ${task.title} đã hoàn thành`
                            : `Mark ${task.title} as completed`,
                      ),
                      frame({ width: 36, maxHeight: 1000, alignment: 'center' }),
                    ]}
                  >
                    <Text
                      modifiers={[
                        font({
                          size: scaleFontSize(isCompleted ? 24 : 28),
                          weight: 'bold',
                        }),
                        foregroundStyle(
                          isCompleted ? completedColor : task.color,
                        ),
                      ]}
                    >
                      {isCompleted ? '✓' : '○'}
                    </Text>
                  </Button>
                  {isCompletionPending ? (
                    <Button
                      target={`${TODAY_WIDGET_UNDO_ACTION}:${task.id}:label`}
                      onPress={() =>
                        undoTodayWidgetSnapshotCompletion(props, task.id)
                      }
                      modifiers={[
                        buttonStyle('plain'),
                        accessibilityLabel(
                          props.language === 'vi'
                            ? `Hoàn tác hoàn thành ${task.title}`
                            : `Undo completing ${task.title}`,
                        ),
                        frame({
                          maxWidth: 1000,
                          maxHeight: 1000,
                          alignment: 'center',
                        }),
                      ]}
                    >
                      <Text
                        modifiers={[
                          font({ size: scaleFontSize(16), weight: 'bold' }),
                          foregroundStyle(accentColor),
                          frame({ maxWidth: 1000, alignment: 'center' }),
                          lineLimit(1),
                        ]}
                      >
                        {props.undoLabel}
                      </Text>
                    </Button>
                  ) : (
                    <VStack alignment="leading" spacing={1}>
                      <Text
                        modifiers={[
                          font({
                            size: scaleFontSize(14),
                            weight: 'bold',
                            design: 'monospaced',
                          }),
                          foregroundStyle(accentColor),
                        ]}
                      >
                        {task.startTime}
                      </Text>
                      <Text
                        modifiers={[
                          font({ size: scaleFontSize(16), weight: 'semibold' }),
                          foregroundStyle(textColor),
                          lineLimit(1),
                        ]}
                      >
                        {task.title}
                      </Text>
                    </VStack>
                  )}
                </HStack>
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}

export const planlyTodayWidget = createWidget<TodayWidgetSnapshot>(
  'PlanlyToday',
  PlanlyTodayWidgetView,
);
