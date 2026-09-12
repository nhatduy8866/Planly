import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Animated, ImageBackground, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AlarmRingingModal, type AlarmModalTaskData } from './AlarmRingingModal';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 44 }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: {
      danger: '#EF4444',
      primary: '#4F46E5',
      primaryDark: '#3730A3',
      priorityHigh: '#EF4444',
      priorityLow: '#3B82F6',
      priorityMedium: '#F59E0B',
      surface: '#1E293B',
      surfaceMuted: '#334155',
      text: '#FFFFFF',
      textMuted: '#94A3B8',
    },
    locale: 'vi-VN',
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'alarmModal.badge') return 'BÁO THỨC';
      if (key === 'alarmModal.dismiss') return 'Tắt báo thức';
      if (key === 'alarmModal.viewTask') return 'Xem công việc';
      if (key === 'alarmModal.startTime') return `Bắt đầu lúc ${params?.time}`;
      if (key === 'taskForm.priorityHigh') return 'Cao';
      if (key === 'taskForm.priorityMedium') return 'Vừa';
      if (key === 'taskForm.priorityLow') return 'Thấp';
      if (key === 'taskForm.priorityNone') return 'Không';
      return key;
    },
  }),
}));

const mockTaskData: AlarmModalTaskData = {
  color: '#10B981',
  description: 'Chạy 5km công viên',
  id: 'task-100',
  priority: 'high',
  startTime: '06:00',
  title: 'Chạy bộ buổi sáng',
};

describe('AlarmRingingModal', () => {
  let tree: renderer.ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.spyOn(Animated, 'loop').mockReturnValue({
      reset: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as any);
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
  });

  it('does not render when visible is false', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={false}
          task={mockTaskData}
          onDismiss={jest.fn()}
          onViewTask={jest.fn()}
        />,
      );
    });

    expect(tree?.toJSON()).toBeNull();
  });

  it('renders task details including title, description, time and priority badge when visible', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
          onViewTask={jest.fn()}
        />,
      );
    });

    const root = tree?.root;
    expect(root).toBeDefined();

    const textNodes = root?.findAllByType(Text);
    const textContents = textNodes?.map((node) => node.props.children).flat();

    expect(textContents).toContain('Chạy bộ buổi sáng');
    expect(textContents).toContain('Chạy 5km công viên');
    expect(textContents).toContain('Bắt đầu lúc 06:00');
    expect(textContents).toContain('Cao');
    expect(textContents).toContain('Tắt báo thức');
    expect(textContents).toContain('Xem công việc');
  });

  it('renders the selected custom background behind the alarm content', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          backgroundUri="file:///planly-alarm-media/background.jpg"
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
          onViewTask={jest.fn()}
        />,
      );
    });

    expect(tree?.root.findByType(ImageBackground).props.source).toEqual({
      uri: 'file:///planly-alarm-media/background.jpg',
    });
  });

  it('triggers onDismiss when Stop button is pressed', () => {
    const onDismiss = jest.fn();
    const onViewTask = jest.fn();

    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={onDismiss}
          onViewTask={onViewTask}
        />,
      );
    });

    const dismissBtn = tree?.root.findByProps({
      accessibilityLabel: 'Tắt báo thức',
    });
    expect(dismissBtn).toBeDefined();

    act(() => {
      dismissBtn?.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onViewTask).not.toHaveBeenCalled();
  });

  it('triggers onViewTask when View Task button is pressed', () => {
    const onDismiss = jest.fn();
    const onViewTask = jest.fn();

    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={onDismiss}
          onViewTask={onViewTask}
        />,
      );
    });

    const viewTaskBtn = tree?.root.findByProps({
      accessibilityLabel: 'Xem công việc',
    });
    expect(viewTaskBtn).toBeDefined();

    act(() => {
      viewTaskBtn?.props.onPress();
    });

    expect(onViewTask).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
