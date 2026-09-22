import { Easing } from 'react-native';

export const MOTION = {
  duration: {
    quick: 120,
    standard: 180,
  },
  entrance: {
    maxAnimatedItems: 12,
    maxDelayMs: 90,
    offsetY: 8,
    staggerMs: 18,
  },
  modalAnimation: 'fade',
  pressedOpacity: 0.72,
} as const;

export const MOTION_EASING = Easing.out(Easing.cubic);
