import { describe, expect, it } from '@jest/globals';

import {
  ALARM_BACKGROUND_PRESETS,
  ALARM_SOUND_PRESETS,
  getAlarmBackgroundAppearance,
  getAlarmBackgroundColor,
  getAlarmSchedulePreferences,
} from './alarmPresets';

describe('alarm presets', () => {
  it('provides five bundled sounds and seven bundled backgrounds', () => {
    expect(ALARM_SOUND_PRESETS).toHaveLength(5);
    expect(ALARM_BACKGROUND_PRESETS).toHaveLength(7);
    expect(new Set(ALARM_SOUND_PRESETS.map((preset) => preset.id)).size).toBe(5);
    expect(
      new Set(ALARM_BACKGROUND_PRESETS.map((preset) => preset.id)).size,
    ).toBe(7);
  });

  it('uses the selected preset appearance and a safe dark treatment for uploads', () => {
    expect(getAlarmBackgroundAppearance('gentleDark', null)).toBe('dark');
    expect(getAlarmBackgroundAppearance('gentleLight', null)).toBe('light');
    expect(
      getAlarmBackgroundAppearance('gentleLight', {
        name: 'custom.jpg',
        uri: 'file:///custom.jpg',
      }),
    ).toBe('dark');
    expect(getAlarmBackgroundColor('gentleDark', null)).toBe('#182136');
    expect(getAlarmBackgroundColor('gentleLight', null)).toBe('#F3EDE4');
  });

  it('uses the bundled native sound unless the user uploaded a file', () => {
    expect(getAlarmSchedulePreferences('gentle', null, true)).toEqual({
      soundName: 'planly_gentle.wav',
      vibrate: true,
    });
    expect(
      getAlarmSchedulePreferences(
        'gentle',
        { name: 'custom.mp3', uri: 'file:///custom.mp3' },
        false,
      ),
    ).toEqual({
      soundUri: 'file:///custom.mp3',
      vibrate: false,
    });
  });
});
