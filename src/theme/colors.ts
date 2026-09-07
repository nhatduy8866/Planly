export const lightColors = {
  background: '#F7F8F4',
  surface: '#FFFFFF',
  surfaceMuted: '#EFF2EC',
  primary: '#46664A',
  primaryDark: '#2E4732',
  primarySoft: '#DDE9DC',
  accent: '#D99652',
  text: '#202720',
  textMuted: '#6D766E',
  border: '#E2E7E0',
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
  aiPrimary: '#2D5A43',
  aiSoft: '#E8F2EC',
  aiTag: '#EBF5EE',
  aiTagText: '#2E6B4B',
  aiUpdatedTag: '#DEF7EC',
  aiUpdatedTagText: '#03543F',
  white: '#FFFFFF',
  shadow: '#172019',
  overlay: 'rgba(23, 32, 25, 0.45)',
  subtleOverlay: 'rgba(0, 0, 0, 0.08)',
  placeholder: '#969E97',
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: '#101512',
  surface: '#18201B',
  surfaceMuted: '#222D26',
  primary: '#64856A',
  primaryDark: '#C2DEC5',
  primarySoft: '#2C4432',
  accent: '#E6A96A',
  text: '#F0F4F0',
  textMuted: '#A7B2A8',
  border: '#344139',
  danger: '#F08B84',
  dangerSoft: '#4A2928',
  warning: '#E5B26F',
  warningSoft: '#473622',
  info: '#8CB9D1',
  infoSoft: '#243A45',
  priorityHigh: '#F87171',
  priorityHighSoft: '#4B2527',
  priorityMedium: '#FBBF24',
  priorityMediumSoft: '#49391D',
  priorityLow: '#60A5FA',
  priorityLowSoft: '#213956',
  aiPrimary: '#A8D5B3',
  aiSoft: '#23382B',
  aiTag: '#284332',
  aiTagText: '#B8E5C2',
  aiUpdatedTag: '#234738',
  aiUpdatedTagText: '#B7F0D1',
  white: '#FFFFFF',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.68)',
  subtleOverlay: 'rgba(0, 0, 0, 0.35)',
  placeholder: '#7F8D82',
};

export const themes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeMode = keyof typeof themes;

// Kept as the light palette for non-React helpers. UI components should use
// the active palette exposed by PreferencesContext.
export const colors = lightColors;
