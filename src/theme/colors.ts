export const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#E0E7FF',
  accent: '#D97706',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
  danger: '#B84D47',
  dangerSoft: '#F8E5E3',
  warning: '#A36A28',
  warningSoft: '#FBF2E3',
  info: '#4B738A',
  infoSoft: '#E6F0F5',
  priorityHigh: '#DC2626',
  priorityHighSoft: '#FEE2E2',
  priorityMedium: '#D97706',
  priorityMediumSoft: '#FEF3C7',
  priorityLow: '#2563EB',
  priorityLowSoft: '#E0F2FE',
  aiPrimary: '#7C3AED',
  aiSoft: '#F3E8FF',
  aiTag: '#EDE9FE',
  aiTagText: '#6D28D9',
  aiUpdatedTag: '#DBEAFE',
  aiUpdatedTagText: '#1D4ED8',
  white: '#FFFFFF',
  shadow: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.45)',
  subtleOverlay: 'rgba(0, 0, 0, 0.08)',
  placeholder: '#94A3B8',
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceMuted: '#334155',
  primary: '#6366F1',
  primaryDark: '#C7D2FE',
  primarySoft: '#312E81',
  accent: '#FBBF24',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
  border: '#475569',
  danger: '#F08B84',
  dangerSoft: '#4A2928',
  warning: '#E5B26F',
  warningSoft: '#473622',
  info: '#7DD3FC',
  infoSoft: '#0C4A6E',
  priorityHigh: '#F87171',
  priorityHighSoft: '#4B2527',
  priorityMedium: '#FBBF24',
  priorityMediumSoft: '#49391D',
  priorityLow: '#60A5FA',
  priorityLowSoft: '#213956',
  aiPrimary: '#C4B5FD',
  aiSoft: '#2E1065',
  aiTag: '#3B0764',
  aiTagText: '#DDD6FE',
  aiUpdatedTag: '#172554',
  aiUpdatedTagText: '#BFDBFE',
  white: '#FFFFFF',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.68)',
  subtleOverlay: 'rgba(0, 0, 0, 0.35)',
  placeholder: '#94A3B8',
};

export const themes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeMode = keyof typeof themes;

// Kept as the light palette for non-React helpers. UI components should use
// the active palette exposed by PreferencesContext.
export const colors = lightColors;
