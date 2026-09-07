import { useMemo } from 'react';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from './colors';

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = usePreferences();
  return useMemo(() => factory(colors), [colors, factory]);
}
