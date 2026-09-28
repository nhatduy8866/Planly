import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { PREFERENCES_STORAGE_KEY } from '../storage/keys';
import type {
  AlarmBackgroundPresetId,
  AlarmFilePreference,
  AlarmSoundPresetId,
  ReminderDeliveryMode,
} from '../types';

interface StoredPreferences {
  acceptedPrivacyPolicyVersion: number;
  alarmBackground: AlarmFilePreference | null;
  alarmBackgroundPreset: AlarmBackgroundPresetId;
  alarmSound: AlarmFilePreference | null;
  alarmSoundPreset: AlarmSoundPresetId;
  alarmVibrationEnabled: boolean;
  hasSeenOnboarding: boolean;
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
  resetPreferences: () => Promise<void>;
  setAcceptedPrivacyPolicyVersion: (version: number) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
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

const DEFAULT_PREFERENCES: StoredPreferences = {
  acceptedPrivacyPolicyVersion: 0,
  alarmBackground: null,
  alarmBackgroundPreset: DEFAULT_ALARM_BACKGROUND_PRESET,
  alarmSound: null,
  alarmSoundPreset: DEFAULT_ALARM_SOUND_PRESET,
  alarmVibrationEnabled: true,
  colorfulAccents: true,
  hasSeenOnboarding: false,
  language: 'vi',
  reminderDeliveryMode: 'notification',
  showTaskBadges: true,
  theme: 'light',
};

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
    value === 'gentleDark' ||
    value === 'gentleLight'
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
  const [acceptedPrivacyPolicyVersion, setAcceptedPrivacyPolicyVersion] =
    useState(DEFAULT_PREFERENCES.acceptedPrivacyPolicyVersion);
  const [alarmBackground, setAlarmBackground] =
    useState<AlarmFilePreference | null>(DEFAULT_PREFERENCES.alarmBackground);
  const [alarmBackgroundPreset, setAlarmBackgroundPreset] =
    useState<AlarmBackgroundPresetId>(DEFAULT_PREFERENCES.alarmBackgroundPreset);
  const [alarmSound, setAlarmSound] = useState<AlarmFilePreference | null>(
    DEFAULT_PREFERENCES.alarmSound,
  );
  const [alarmSoundPreset, setAlarmSoundPreset] =
    useState<AlarmSoundPresetId>(DEFAULT_PREFERENCES.alarmSoundPreset);
  const [alarmVibrationEnabled, setAlarmVibrationEnabled] = useState(
    DEFAULT_PREFERENCES.alarmVibrationEnabled,
  );
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_PREFERENCES.theme);
  const [language, setLanguage] = useState<Language>(
    DEFAULT_PREFERENCES.language,
  );
  const [colorfulAccents, setColorfulAccents] = useState(
    DEFAULT_PREFERENCES.colorfulAccents,
  );
  const [showTaskBadges, setShowTaskBadges] = useState(
    DEFAULT_PREFERENCES.showTaskBadges,
  );
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(
    DEFAULT_PREFERENCES.hasSeenOnboarding,
  );
  const [reminderDeliveryMode, setReminderDeliveryMode] =
    useState<ReminderDeliveryMode>(DEFAULT_PREFERENCES.reminderDeliveryMode);
  const [hydrated, setHydrated] = useState(false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistPreferences = useCallback((preferences: StoredPreferences) => {
    const serialized = JSON.stringify(preferences);
    const nextWrite = writeQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, serialized));
    writeQueueRef.current = nextWrite.catch(() => undefined);
    return nextWrite;
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<StoredPreferences>) : {};
        if (!active) return;
        if (
          typeof parsed.acceptedPrivacyPolicyVersion === 'number' &&
          Number.isInteger(parsed.acceptedPrivacyPolicyVersion) &&
          parsed.acceptedPrivacyPolicyVersion >= 0
        ) {
          setAcceptedPrivacyPolicyVersion(parsed.acceptedPrivacyPolicyVersion);
        }
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
        if (typeof parsed.hasSeenOnboarding === 'boolean') {
          setHasSeenOnboarding(parsed.hasSeenOnboarding);
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
    void persistPreferences({
      acceptedPrivacyPolicyVersion,
      alarmBackground,
      alarmBackgroundPreset,
      alarmSound,
      alarmSoundPreset,
      alarmVibrationEnabled,
      colorfulAccents,
      hasSeenOnboarding,
      language,
      reminderDeliveryMode,
      showTaskBadges,
      theme,
    }).catch(() => undefined);
  }, [
    acceptedPrivacyPolicyVersion,
    alarmBackground,
    alarmBackgroundPreset,
    alarmSound,
    alarmSoundPreset,
    alarmVibrationEnabled,
    colorfulAccents,
    hasSeenOnboarding,
    hydrated,
    language,
    persistPreferences,
    reminderDeliveryMode,
    showTaskBadges,
    theme,
  ]);

  const t = useCallback<Translate>(
    (key, values) => translate(language, key, values),
    [language],
  );

  const resetPreferences = useCallback(async () => {
    setAcceptedPrivacyPolicyVersion(DEFAULT_PREFERENCES.acceptedPrivacyPolicyVersion);
    setAlarmBackground(DEFAULT_PREFERENCES.alarmBackground);
    setAlarmBackgroundPreset(DEFAULT_PREFERENCES.alarmBackgroundPreset);
    setAlarmSound(DEFAULT_PREFERENCES.alarmSound);
    setAlarmSoundPreset(DEFAULT_PREFERENCES.alarmSoundPreset);
    setAlarmVibrationEnabled(DEFAULT_PREFERENCES.alarmVibrationEnabled);
    setColorfulAccents(DEFAULT_PREFERENCES.colorfulAccents);
    setHasSeenOnboarding(DEFAULT_PREFERENCES.hasSeenOnboarding);
    setLanguage(DEFAULT_PREFERENCES.language);
    setReminderDeliveryMode(DEFAULT_PREFERENCES.reminderDeliveryMode);
    setShowTaskBadges(DEFAULT_PREFERENCES.showTaskBadges);
    setTheme(DEFAULT_PREFERENCES.theme);
    await persistPreferences(DEFAULT_PREFERENCES);
  }, [persistPreferences]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      acceptedPrivacyPolicyVersion,
      alarmBackground,
      alarmBackgroundPreset,
      alarmSound,
      alarmSoundPreset,
      alarmVibrationEnabled,
      colorfulAccents,
      colors: themes[theme],
      hasSeenOnboarding,
      hydrated,
      language,
      locale: language === 'vi' ? 'vi-VN' : 'en-US',
      reminderDeliveryMode,
      resetPreferences,
      setAcceptedPrivacyPolicyVersion,
      setColorfulAccents,
      setAlarmBackground,
      setAlarmBackgroundPreset,
      setAlarmSound,
      setAlarmSoundPreset,
      setAlarmVibrationEnabled,
      setHasSeenOnboarding,
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
      acceptedPrivacyPolicyVersion,
      alarmBackground,
      alarmBackgroundPreset,
      alarmSound,
      alarmSoundPreset,
      alarmVibrationEnabled,
      colorfulAccents,
      hasSeenOnboarding,
      hydrated,
      language,
      reminderDeliveryMode,
      resetPreferences,
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
