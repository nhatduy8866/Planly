export const APP_FONT_SIZE_MULTIPLIER = 1.2;

export function scaleFontSize(size: number): number {
  return size * APP_FONT_SIZE_MULTIPLIER;
}

export function scaleNamedFontSizes<T>(styles: T): T {
  if (!styles || typeof styles !== 'object') return styles;

  return Object.fromEntries(
    Object.entries(styles as Record<string, unknown>).map(([name, style]) => {
      if (!style || typeof style !== 'object' || Array.isArray(style)) {
        return [name, style];
      }

      const fontSize = (style as { fontSize?: unknown }).fontSize;
      if (typeof fontSize !== 'number') return [name, style];

      return [name, { ...style, fontSize: scaleFontSize(fontSize) }];
    }),
  ) as T;
}
