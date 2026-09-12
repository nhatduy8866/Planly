import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  PreferencesProvider,
  usePreferences,
} from './PreferencesContext';

const mockGetItem = jest.fn<(key: string) => Promise<string | null>>();
const mockSetItem = jest.fn<(key: string, value: string) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

interface TestRendererInstance {
  unmount(): void;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer') as {
  create(element: ReturnType<typeof createElement>): TestRendererInstance;
};

describe('PreferencesProvider reminder mode', () => {
  let preferences!: ReturnType<typeof usePreferences>;
  let tree: TestRendererInstance | undefined;

  function Harness() {
    preferences = usePreferences();
    return null;
  }

  async function renderProvider() {
    await act(async () => {
      tree = create(
        createElement(PreferencesProvider, null, createElement(Harness)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => tree?.unmount());
    tree = undefined;
  });

  it('defaults to a standard notification when no preference was saved', async () => {
    await renderProvider();

    expect(preferences.hydrated).toBe(true);
    expect(preferences.reminderDeliveryMode).toBe('notification');
    expect(preferences.alarmBackground).toBeNull();
    expect(preferences.alarmBackgroundPreset).toBe('dawn');
    expect(preferences.alarmSound).toBeNull();
    expect(preferences.alarmSoundPreset).toBe('classic');
    expect(preferences.alarmVibrationEnabled).toBe(true);
    expect(mockSetItem).toHaveBeenLastCalledWith(
      '@planly/preferences/v1',
      expect.stringContaining('"reminderDeliveryMode":"notification"'),
    );
  });

  it('restores a saved alarm preference', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        alarmBackground: { name: 'night.jpg', uri: 'file:///night.jpg' },
        alarmBackgroundPreset: 'cosmos',
        alarmSound: { name: 'bell.mp3', uri: 'file:///bell.mp3' },
        alarmSoundPreset: 'gentle',
        alarmVibrationEnabled: false,
        reminderDeliveryMode: 'alarm',
      }),
    );

    await renderProvider();

    expect(preferences.reminderDeliveryMode).toBe('alarm');
    expect(preferences.alarmBackground).toEqual({
      name: 'night.jpg',
      uri: 'file:///night.jpg',
    });
    expect(preferences.alarmSound).toEqual({
      name: 'bell.mp3',
      uri: 'file:///bell.mp3',
    });
    expect(preferences.alarmBackgroundPreset).toBe('cosmos');
    expect(preferences.alarmSoundPreset).toBe('gentle');
    expect(preferences.alarmVibrationEnabled).toBe(false);
  });
});
