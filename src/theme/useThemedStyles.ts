import { useMemo } from 'react';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from './colors';
import { scaleNamedFontSizes } from './typography';

interface ThemedStylesOptions {
  scaleFontSizes?: boolean;
}

export function useThemedStyles<T>(
  factory: (colors: ThemeColors) => T,
  options?: ThemedStylesOptions,
): T {
  const { colors } = usePreferences();
  const shouldScaleFontSizes = options?.scaleFontSizes ?? true;

  return useMemo(() => {
    const styles = factory(colors);
    return shouldScaleFontSizes ? scaleNamedFontSizes(styles) : styles;
  }, [colors, factory, shouldScaleFontSizes]);
}
