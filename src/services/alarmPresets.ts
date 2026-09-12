import type { ImageSourcePropType } from 'react-native';

import type {
  AlarmBackgroundPresetId,
  AlarmFilePreference,
  AlarmSchedulePreferences,
  AlarmSoundPresetId,
} from '../types';

export const DEFAULT_ALARM_SOUND_PRESET: AlarmSoundPresetId = 'classic';
export const DEFAULT_ALARM_BACKGROUND_PRESET: AlarmBackgroundPresetId = 'dawn';

export const ALARM_SOUND_PRESETS = [
  {
    id: 'classic',
    labelKey: 'settings.alarmSoundClassic',
    nativeName: 'planly_classic.wav',
    source: require('../../assets/alarm/sounds/planly_classic.wav'),
  },
  {
    id: 'sunrise',
    labelKey: 'settings.alarmSoundSunrise',
    nativeName: 'planly_sunrise.wav',
    source: require('../../assets/alarm/sounds/planly_sunrise.wav'),
  },
  {
    id: 'gentle',
    labelKey: 'settings.alarmSoundGentle',
    nativeName: 'planly_gentle.wav',
    source: require('../../assets/alarm/sounds/planly_gentle.wav'),
  },
  {
    id: 'pulse',
    labelKey: 'settings.alarmSoundPulse',
    nativeName: 'planly_pulse.wav',
    source: require('../../assets/alarm/sounds/planly_pulse.wav'),
  },
  {
    id: 'digital',
    labelKey: 'settings.alarmSoundDigital',
    nativeName: 'planly_digital.wav',
    source: require('../../assets/alarm/sounds/planly_digital.wav'),
  },
] as const;

export const ALARM_BACKGROUND_PRESETS = [
  {
    id: 'dawn',
    labelKey: 'settings.alarmBackgroundDawn',
    source: require('../../assets/alarm/backgrounds/dawn.png'),
  },
  {
    id: 'aurora',
    labelKey: 'settings.alarmBackgroundAurora',
    source: require('../../assets/alarm/backgrounds/aurora.png'),
  },
  {
    id: 'forest',
    labelKey: 'settings.alarmBackgroundForest',
    source: require('../../assets/alarm/backgrounds/forest.png'),
  },
  {
    id: 'ocean',
    labelKey: 'settings.alarmBackgroundOcean',
    source: require('../../assets/alarm/backgrounds/ocean.png'),
  },
  {
    id: 'cosmos',
    labelKey: 'settings.alarmBackgroundCosmos',
    source: require('../../assets/alarm/backgrounds/cosmos.png'),
  },
] as const;

export function getAlarmSoundPreset(id: AlarmSoundPresetId) {
  return (
    ALARM_SOUND_PRESETS.find((preset) => preset.id === id) ??
    ALARM_SOUND_PRESETS[0]
  );
}

export function getAlarmBackgroundPreset(id: AlarmBackgroundPresetId) {
  return (
    ALARM_BACKGROUND_PRESETS.find((preset) => preset.id === id) ??
    ALARM_BACKGROUND_PRESETS[0]
  );
}

export function getAlarmSoundSource(
  presetId: AlarmSoundPresetId,
  customSound: AlarmFilePreference | null,
): number | string {
  return customSound?.uri ?? getAlarmSoundPreset(presetId).source;
}

export function getAlarmBackgroundSource(
  presetId: AlarmBackgroundPresetId,
  customBackground: AlarmFilePreference | null,
): ImageSourcePropType {
  return customBackground
    ? { uri: customBackground.uri }
    : getAlarmBackgroundPreset(presetId).source;
}

export function getAlarmSchedulePreferences(
  presetId: AlarmSoundPresetId,
  customSound: AlarmFilePreference | null,
  vibrate: boolean,
): AlarmSchedulePreferences {
  return customSound
    ? { soundUri: customSound.uri, vibrate }
    : { soundName: getAlarmSoundPreset(presetId).nativeName, vibrate };
}
