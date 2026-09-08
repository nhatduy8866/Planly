import { MaterialIcons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';

interface AiSuccessViewProps {
  tasksCount: number;
  onViewSchedule: () => void;
  onAddAnother: () => void;
}

export function AiSuccessView({
  tasksCount,
  onViewSchedule,
  onAddAnother,
}: AiSuccessViewProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        {/* Celebration Illustration */}
        <View style={styles.iconWrap}>
          {/* Confetti particles */}
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
          <View style={[styles.dot, styles.dot4]} />
          <View style={[styles.dot, styles.dot5]} />
          <View style={[styles.dot, styles.dot6]} />

          <View style={styles.checkCircle}>
            <MaterialIcons name="check" size={38} color={colors.white} />
          </View>
        </View>

        <Text style={styles.title}>{t('ai.successTitle', { count: tasksCount })}</Text>
        <Text style={styles.description}>{t('ai.successDescription')}</Text>
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <Pressable
          onPress={onViewSchedule}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{t('ai.viewSchedule')}</Text>
        </Pressable>

        <Pressable
          onPress={onAddAnother}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>{t('ai.addAnother')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
    width: 120,
  },
  checkCircle: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    position: 'absolute',
    width: 8,
  },
  dot1: { backgroundColor: '#F87171', top: 12, left: 30 },
  dot2: { backgroundColor: '#FBBF24', top: 8, right: 35 },
  dot3: { backgroundColor: '#60A5FA', bottom: 15, left: 24 },
  dot4: { backgroundColor: '#34D399', bottom: 18, right: 28 },
  dot5: { backgroundColor: '#A78BFA', top: 40, left: 8 },
  dot6: { backgroundColor: '#F472B6', top: 46, right: 10 },
  title: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
