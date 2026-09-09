import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

export interface AnimatedEntryItemProps {
  index: number;
  triggerKey?: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  staggerMs?: number;
  maxDelayMs?: number;
  duration?: number;
  offsetY?: number;
}

export function AnimatedEntryItem({
  index,
  triggerKey,
  children,
  style,
  staggerMs = 35,
  maxDelayMs = 240,
  duration = 240,
  offsetY = 16,
}: AnimatedEntryItemProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animValue.setValue(0);
    const delay = Math.min(index * staggerMs, maxDelayMs);

    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(animValue, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animValue, duration, index, maxDelayMs, staggerMs, triggerKey]);

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
}
