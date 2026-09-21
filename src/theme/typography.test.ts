import { describe, expect, it } from '@jest/globals';

import {
  APP_FONT_SIZE_MULTIPLIER,
  scaleFontSize,
  scaleNamedFontSizes,
} from './typography';

describe('typography', () => {
  it('scales a font size by the app multiplier', () => {
    expect(APP_FONT_SIZE_MULTIPLIER).toBe(1.2);
    expect(scaleFontSize(15)).toBe(18);
  });

  it('scales only font sizes in a named style collection', () => {
    const original = {
      container: { padding: 12 },
      label: { fontSize: 14, fontWeight: '700' as const },
    };

    expect(scaleNamedFontSizes(original)).toEqual({
      container: { padding: 12 },
      label: { fontSize: 16.8, fontWeight: '700' },
    });
    expect(original.label.fontSize).toBe(14);
  });
});
