import { describe, expect, it } from '@jest/globals';

import {
  ALARM_BACKGROUND_PRESETS,
  ALARM_SOUND_PRESETS,
  getAlarmSchedulePreferences,
} from './alarmPresets';

describe('alarm presets', () => {
  it('provides exactly five bundled sounds and five bundled backgrounds', () => {
    expect(ALARM_SOUND_PRESETS).toHaveLength(5);
    expect(ALARM_BACKGROUND_PRESETS).toHaveLength(5);
    expect(new Set(ALARM_SOUND_PRESETS.map((preset) => preset.id)).size).toBe(5);
    expect(
      new Set(ALARM_BACKGROUND_PRESETS.map((preset) => preset.id)).size,
    ).toBe(5);
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
