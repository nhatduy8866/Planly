import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { AppState, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AppMenu } from './AppMenu';

const mockSetAlarmBackground = jest.fn();
const mockSetAlarmBackgroundPreset = jest.fn();
const mockSetAlarmSound = jest.fn();
const mockSetAlarmSoundPreset = jest.fn();
const mockSetAlarmVibrationEnabled = jest.fn();
const mockPreviewPlayer = {
  loop: false,
  pause: jest.fn(),
  play: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  volume: 1,
};

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioPlayer: () => mockPreviewPlayer,
  useAudioPlayerStatus: () => ({ didJustFinish: false, playing: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    configured: false,
    hydrated: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    user: null,
  }),
}));

jest.mock('../sync/CloudSyncContext', () => ({
  useCloudSync: () => ({
    lastSyncedAt: null,
    pendingCount: 0,
    status: 'disabled',
    syncNow: jest.fn(),
  }),
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    alarmBackground: null,
    alarmBackgroundPreset: 'dawn',
    alarmSound: null,
    alarmSoundPreset: 'classic',
    alarmVibrationEnabled: true,
    colorfulAccents: true,
    colors: {
      background: '#F8FAFC',
      border: '#E2E8F0',
      danger: '#EF4444',
      dangerSoft: '#FEE2E2',
      overlay: 'rgba(0, 0, 0, 0.4)',
      primary: '#4F46E5',
      primaryDark: '#3730A3',
      primarySoft: '#EEF2FF',
      surface: '#FFFFFF',
      surfaceMuted: '#F1F5F9',
      text: '#0F172A',
      textMuted: '#64748B',
      white: '#FFFFFF',
    },
    language: 'vi',
    reminderDeliveryMode: 'alarm',
    setAlarmBackground: mockSetAlarmBackground,
    setAlarmBackgroundPreset: mockSetAlarmBackgroundPreset,
    setAlarmSound: mockSetAlarmSound,
    setAlarmSoundPreset: mockSetAlarmSoundPreset,
    setAlarmVibrationEnabled: mockSetAlarmVibrationEnabled,
    setColorfulAccents: jest.fn(),
    setReminderDeliveryMode: jest.fn(),
    setShowTaskBadges: jest.fn(),
    showTaskBadges: true,
    t: (key: string) => key,
    theme: 'light',
    toggleLanguage: jest.fn(),
    toggleTheme: jest.fn(),
  }),
}));

jest.mock('../services/alarmMedia', () => ({
  AlarmMediaError: class AlarmMediaError extends Error {},
  pickAlarmMedia: jest.fn(),
}));

jest.mock('../services/alarms', () => ({
  getAlarmPermission: jest.fn(async () => ({
    available: true,
    canOpenSettings: true,
    canPostNotifications: true,
    canScheduleExactAlarms: true,
    canUseFullScreenIntent: true,
    state: 'granted',
  })),
  openAlarmSettings: jest.fn(),
  openFullScreenAlarmSettings: jest.fn(),
  requestAlarmPermission: jest.fn(),
}));

jest.mock('../services/notifications', () => ({
  getNotificationPermission: jest.fn(async () => ({
    canAskAgain: true,
    state: 'granted',
  })),
  openNotificationSettings: jest.fn(),
  requestNotificationPermission: jest.fn(),
}));

describe('AppMenu settings', () => {
  let tree: renderer.ReactTestRenderer | undefined;

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shows alarm customization without duplicating hamburger preferences', () => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
    act(() => {
      tree = renderer.create(
        <AppMenu visible={true} onRequestClose={jest.fn()} />,
      );
    });

    const openSettings = tree?.root.findByProps({
      accessibilityLabel: 'menu.openSettings',
    });
    act(() => openSettings?.props.onPress());

    const text = tree?.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat();
    expect(text).toEqual(
      expect.arrayContaining([
        'settings.alarmVibrationTitle',
        'settings.alarmSoundTitle',
        'settings.alarmBackgroundTitle',
      ]),
    );
    expect(text).not.toContain('settings.title');
    expect(text).not.toContain('settings.appearanceTitle');
    expect(text).not.toContain('settings.languageTitle');
    expect(text).not.toContain('settings.alarmVibrationDescription');
    expect(text).not.toContain('settings.alarmSoundDefaultDescription');
    expect(text).not.toContain('settings.alarmBackgroundDefaultDescription');
  });

  it('shows five preset sounds plus upload and lets users preview before selecting', async () => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
    act(() => {
      tree = renderer.create(
        <AppMenu visible={true} onRequestClose={jest.fn()} />,
      );
    });

    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'menu.openSettings' })
        .props.onPress();
    });
    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmSoundTitle' })
        .props.onPress();
    });

    const soundOptions = Array.from(
      new Set(
        tree?.root
          .findAll((node) => node.props.accessibilityRole === 'radio')
          .map((node) => node.props.accessibilityLabel),
      ),
    );
    expect(soundOptions).toEqual([
      'settings.alarmSoundClassic',
      'settings.alarmSoundSunrise',
      'settings.alarmSoundGentle',
      'settings.alarmSoundPulse',
      'settings.alarmSoundDigital',
      'settings.alarmSoundUpload',
    ]);

    await act(async () => {
      tree?.root
        .findAllByProps({ accessibilityLabel: 'settings.alarmPreviewPlay' })[0]
        .props.onPress({ stopPropagation: jest.fn() });
      await Promise.resolve();
    });
    expect(mockPreviewPlayer.replace).toHaveBeenCalled();
    expect(mockPreviewPlayer.play).toHaveBeenCalled();

    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmSoundClassic' })
        .props.onPress();
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmVibrationTitle' })
        .props.onPress();
    });
    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmVibrationDisabled' })
        .props.onPress();
    });

    expect(mockSetAlarmSound).toHaveBeenCalledWith(null);
    expect(mockSetAlarmSoundPreset).toHaveBeenCalledWith('classic');
    expect(mockSetAlarmVibrationEnabled).toHaveBeenCalledWith(false);
  });

  it('shows five background thumbnails plus upload and opens a full preview', () => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    });
    act(() => {
      tree = renderer.create(
        <AppMenu visible={true} onRequestClose={jest.fn()} />,
      );
    });

    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'menu.openSettings' })
        .props.onPress();
    });
    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmBackgroundTitle' })
        .props.onPress();
    });

    const backgroundOptions = Array.from(
      new Set(
        tree?.root
          .findAll((node) => node.props.accessibilityRole === 'radio')
          .map((node) => node.props.accessibilityLabel),
      ),
    );
    expect(backgroundOptions).toEqual([
      'settings.alarmBackgroundDawn',
      'settings.alarmBackgroundAurora',
      'settings.alarmBackgroundForest',
      'settings.alarmBackgroundOcean',
      'settings.alarmBackgroundCosmos',
      'settings.alarmBackgroundUpload',
    ]);

    act(() => {
      tree?.root
        .findAllByProps({ accessibilityLabel: 'settings.alarmPreviewImage' })[0]
        .props.onPress({ stopPropagation: jest.fn() });
    });
    expect(
      tree?.root.findByProps({
        accessibilityLabel: 'settings.alarmPreviewClose',
      }),
    ).toBeDefined();

    act(() => {
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmPreviewClose' })
        .props.onPress();
      tree?.root
        .findByProps({ accessibilityLabel: 'settings.alarmBackgroundAurora' })
        .props.onPress();
    });
    expect(mockSetAlarmBackground).toHaveBeenCalledWith(null);
    expect(mockSetAlarmBackgroundPreset).toHaveBeenCalledWith('aurora');
  });
});
