import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { Dimensions, ImageBackground, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AlarmRingingModal, type AlarmModalTaskData } from './AlarmRingingModal';

const mockAlarmPlayer = {
  loop: false,
  pause: jest.fn(),
  play: jest.fn(),
  volume: 1,
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: () => mockAlarmPlayer,
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
    t: (key: string) => {
      if (key === 'alarmModal.confirm') return 'Xác nhận';
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
    jest.clearAllMocks();
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
        />,
      );
    });

    expect(tree?.toJSON()).toBeNull();
  });

  it('renders task details without start time or priority labels when visible', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
        />,
      );
    });

    const root = tree?.root;
    expect(root).toBeDefined();

    const textNodes = root?.findAllByType(Text);
    const textContents = textNodes?.map((node) => node.props.children).flat();

    expect(textContents).toContain('Chạy bộ buổi sáng');
    expect(textContents).toContain('Chạy 5km công viên');
    expect(textContents).toContain('06:00');
    expect(textContents).toContain('Xác nhận');
    expect(textContents).not.toContain('Bắt đầu lúc 06:00');
    expect(textContents).not.toContain('Cao');
    expect(textContents).not.toContain('BÁO THỨC');
    expect(textContents).not.toContain('Xem công việc');
  });

  it('renders the selected custom background behind the alarm content', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          backgroundSource={{
            uri: 'file:///planly-alarm-media/background.jpg',
          }}
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
        />,
      );
    });

    expect(tree?.root.findByType(ImageBackground).props.source).toEqual({
      uri: 'file:///planly-alarm-media/background.jpg',
    });
  });

  it('continues the selected sound from the app-owned alarm screen', async () => {
    await act(async () => {
      tree = renderer.create(
        <AlarmRingingModal
          soundSource="file:///planly-alarm-media/sound.wav"
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
        />,
      );
      await Promise.resolve();
    });

    expect(mockAlarmPlayer.loop).toBe(true);
    expect(mockAlarmPlayer.play).toHaveBeenCalled();
  });

  it('triggers onDismiss when the confirmation button is pressed', () => {
    const onDismiss = jest.fn();

    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={onDismiss}
        />,
      );
    });

    const dismissBtn = tree?.root.findByProps({
      accessibilityLabel: 'Xác nhận',
    });
    expect(dismissBtn).toBeDefined();

    act(() => {
      dismissBtn?.props.onPress();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('uses the task priority color and enlarged confirmation size', () => {
    act(() => {
      tree = renderer.create(
        <AlarmRingingModal
          visible={true}
          task={mockTaskData}
          onDismiss={jest.fn()}
        />,
      );
    });

    const confirmButton = tree?.root.findByProps({
      accessibilityLabel: 'Xác nhận',
    });
    const expectedSize = Math.min(Dimensions.get('window').width / 2, 216);

    expect(confirmButton?.props.style({ pressed: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#EF4444',
          height: expectedSize,
          width: expectedSize,
        }),
      ]),
    );
  });
});
