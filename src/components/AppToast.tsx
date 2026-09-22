import { MaterialIcons } from '@expo/vector-icons';
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
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

const TOAST_DURATION_MS = 2_800;

interface ToastMessage {
  id: number;
  message: string;
}

interface ToastContextValue {
  dismissToast: () => void;
  showToast: (message: string) => void;
  toast: ToastMessage | null;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextToastId = useRef(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message: string) => {
    nextToastId.current += 1;
    setToast({ id: nextToastId.current, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(dismissToast, TOAST_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [dismissToast, toast]);

  const value = useMemo(
    () => ({ dismissToast, showToast, toast }),
    [dismissToast, showToast, toast],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): Pick<ToastContextValue, 'showToast'> {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return { showToast: context.showToast };
}

function ToastCard({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      duration: 180,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        {
          opacity: entrance,
          transform: [{
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          }],
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <MaterialIcons name="check" size={18} color={colors.white} />
      </View>
      <Text numberOfLines={2} style={styles.message}>{message}</Text>
      <Pressable
        accessibilityLabel={t('common.close')}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onDismiss}
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
      >
        <MaterialIcons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

export function AppToastViewport({ bottomOffset = 74 }: { bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  const context = useContext(ToastContext);
  const styles = useThemedStyles(createStyles);

  if (!context) {
    throw new Error('AppToastViewport must be used inside ToastProvider');
  }
  if (!context.toast) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.layer,
        { bottom: bottomOffset + insets.bottom },
      ]}
    >
      <ToastCard
        key={context.toast.id}
        message={context.toast.message}
        onDismiss={context.dismissToast}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 448,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: colors.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    width: '100%',
  },
  dismiss: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 28,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  layer: {
    alignItems: 'center',
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
  message: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: { opacity: 0.65 },
});
