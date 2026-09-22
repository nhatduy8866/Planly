import { memo, useEffect, useState, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { MOTION, MOTION_EASING } from '../../theme/motion';
import { useReducedMotion } from './MotionProvider';

export interface AnimatedEntryItemProps {
  index: number;
  triggerKey?: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  staggerMs?: number;
  maxDelayMs?: number;
  maxAnimatedItems?: number;
  duration?: number;
  offsetY?: number;
}

export const AnimatedEntryItem = memo(function AnimatedEntryItem({
  index,
  triggerKey,
  children,
  style,
  staggerMs = MOTION.entrance.staggerMs,
  maxDelayMs = MOTION.entrance.maxDelayMs,
  maxAnimatedItems = MOTION.entrance.maxAnimatedItems,
  duration = MOTION.duration.standard,
  offsetY = MOTION.entrance.offsetY,
}: AnimatedEntryItemProps) {
  const [animValue] = useState(() => new Animated.Value(0));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || index >= maxAnimatedItems) {
      animValue.setValue(1);
      return;
    }

    animValue.setValue(0);
    const delay = Math.min(index * staggerMs, maxDelayMs);

    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(animValue, {
        toValue: 1,
        duration,
        easing: MOTION_EASING,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    animValue,
    duration,
    index,
    maxAnimatedItems,
    maxDelayMs,
    reducedMotion,
    staggerMs,
    triggerKey,
  ]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: animValue,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});
