import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  translate,
  type Language,
  type Translate,
} from '../i18n/translations';
import {
  DEFAULT_ALARM_BACKGROUND_PRESET,
  DEFAULT_ALARM_SOUND_PRESET,
} from '../services/alarmPresets';
import {
  themes,
  type ThemeColors,
  type ThemeMode,
} from '../theme/colors';
import type {
  AlarmBackgroundPresetId,
  AlarmFilePreference,
  AlarmSoundPresetId,
  ReminderDeliveryMode,
} from '../types';

const STORAGE_KEY = '@planly/preferences/v1';

interface StoredPreferences {
  alarmBackground: AlarmFilePreference | null;
  alarmBackgroundPreset: AlarmBackgroundPresetId;
  alarmSound: AlarmFilePreference | null;
  alarmSoundPreset: AlarmSoundPresetId;
  alarmVibrationEnabled: boolean;
  theme: ThemeMode;
  language: Language;
  colorfulAccents: boolean;
  showTaskBadges: boolean;
  reminderDeliveryMode: ReminderDeliveryMode;
}

interface PreferencesContextValue extends StoredPreferences {
  colors: ThemeColors;
  hydrated: boolean;
  locale: 'vi-VN' | 'en-US';
  setColorfulAccents: (enabled: boolean) => void;
  setAlarmBackground: (background: AlarmFilePreference | null) => void;
  setAlarmBackgroundPreset: (preset: AlarmBackgroundPresetId) => void;
  setAlarmSound: (sound: AlarmFilePreference | null) => void;
  setAlarmSoundPreset: (preset: AlarmSoundPresetId) => void;
  setAlarmVibrationEnabled: (enabled: boolean) => void;
  setLanguage: (language: Language) => void;
  setReminderDeliveryMode: (mode: ReminderDeliveryMode) => void;
  setShowTaskBadges: (enabled: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  t: Translate;
  toggleLanguage: () => void;
  toggleTheme: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

function isLanguage(value: unknown): value is Language {
  return value === 'vi' || value === 'en';
}

function isReminderDeliveryMode(value: unknown): value is ReminderDeliveryMode {
  return value === 'notification' || value === 'alarm';
}

function isAlarmSoundPresetId(value: unknown): value is AlarmSoundPresetId {
  return (
    value === 'classic' ||
    value === 'sunrise' ||
    value === 'gentle' ||
    value === 'pulse' ||
    value === 'digital'
  );
}

function isAlarmBackgroundPresetId(
  value: unknown,
): value is AlarmBackgroundPresetId {
  return (
    value === 'dawn' ||
    value === 'aurora' ||
    value === 'forest' ||
    value === 'ocean' ||
    value === 'cosmos'
  );
}

function isAlarmFilePreference(value: unknown): value is AlarmFilePreference {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<AlarmFilePreference>;
  return (
    typeof file.name === 'string' &&
    file.name.length > 0 &&
    typeof file.uri === 'string' &&
    file.uri.length > 0
  );
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [alarmBackground, setAlarmBackground] =
    useState<AlarmFilePreference | null>(null);
  const [alarmBackgroundPreset, setAlarmBackgroundPreset] =
    useState<AlarmBackgroundPresetId>(DEFAULT_ALARM_BACKGROUND_PRESET);
  const [alarmSound, setAlarmSound] = useState<AlarmFilePreference | null>(null);
  const [alarmSoundPreset, setAlarmSoundPreset] =
    useState<AlarmSoundPresetId>(DEFAULT_ALARM_SOUND_PRESET);
  const [alarmVibrationEnabled, setAlarmVibrationEnabled] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [language, setLanguage] = useState<Language>('vi');
  const [colorfulAccents, setColorfulAccents] = useState(true);
  const [showTaskBadges, setShowTaskBadges] = useState(true);
  const [reminderDeliveryMode, setReminderDeliveryMode] =
    useState<ReminderDeliveryMode>('notification');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<StoredPreferences>) : {};
        if (!active) return;
        if (isAlarmFilePreference(parsed.alarmBackground)) {
          setAlarmBackground(parsed.alarmBackground);
        }
        if (isAlarmBackgroundPresetId(parsed.alarmBackgroundPreset)) {
          setAlarmBackgroundPreset(parsed.alarmBackgroundPreset);
        }
        if (isAlarmFilePreference(parsed.alarmSound)) {
          setAlarmSound(parsed.alarmSound);
        }
        if (isAlarmSoundPresetId(parsed.alarmSoundPreset)) {
          setAlarmSoundPreset(parsed.alarmSoundPreset);
        }
        if (typeof parsed.alarmVibrationEnabled === 'boolean') {
          setAlarmVibrationEnabled(parsed.alarmVibrationEnabled);
        }
        if (isThemeMode(parsed.theme)) setTheme(parsed.theme);
        if (isLanguage(parsed.language)) setLanguage(parsed.language);
        if (typeof parsed.colorfulAccents === 'boolean') {
          setColorfulAccents(parsed.colorfulAccents);
        }
        if (typeof parsed.showTaskBadges === 'boolean') {
          setShowTaskBadges(parsed.showTaskBadges);
        }
        if (isReminderDeliveryMode(parsed.reminderDeliveryMode)) {
          setReminderDeliveryMode(parsed.reminderDeliveryMode);
        }
      } catch {
        // Invalid or unavailable storage falls back to the default preferences.
      } finally {
        if (active) setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        alarmBackground,
        alarmBackgroundPreset,
        alarmSound,
        alarmSoundPreset,
        alarmVibrationEnabled,
        colorfulAccents,
        language,
        reminderDeliveryMode,
        showTaskBadges,
        theme,
      }),
    );
  }, [
    alarmBackground,
    alarmBackgroundPreset,
    alarmSound,
    alarmSoundPreset,
    alarmVibrationEnabled,
    colorfulAccents,
    hydrated,
    language,
    reminderDeliveryMode,
    showTaskBadges,
    theme,
  ]);

  const t = useCallback<Translate>(
    (key, values) => translate(language, key, values),
    [language],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      alarmBackground,
      alarmBackgroundPreset,
      alarmSound,
      alarmSoundPreset,
      alarmVibrationEnabled,
      colorfulAccents,
      colors: themes[theme],
      hydrated,
      language,
      locale: language === 'vi' ? 'vi-VN' : 'en-US',
      reminderDeliveryMode,
      setColorfulAccents,
      setAlarmBackground,
      setAlarmBackgroundPreset,
      setAlarmSound,
      setAlarmSoundPreset,
      setAlarmVibrationEnabled,
      setLanguage,
      setReminderDeliveryMode,
      setShowTaskBadges,
      setTheme,
      showTaskBadges,
      t,
      theme,
      toggleLanguage: () => setLanguage((current) => (current === 'vi' ? 'en' : 'vi')),
      toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [
      alarmBackground,
      alarmBackgroundPreset,
      alarmSound,
      alarmSoundPreset,
      alarmVibrationEnabled,
      colorfulAccents,
      hydrated,
      language,
      reminderDeliveryMode,
      showTaskBadges,
      t,
      theme,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}
