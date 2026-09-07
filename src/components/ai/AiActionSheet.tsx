import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';

interface AiActionSheetProps {
  onSelectAi: () => void;
  onSelectManual: () => void;
  onCancel: () => void;
}

export function AiActionSheet({
  onSelectAi,
  onSelectManual,
  onCancel,
}: AiActionSheetProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('ai.addQuestion')}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={onSelectAi}
        style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
      >
        <View style={styles.iconWrapAi}>
          <MaterialIcons name="auto-awesome" size={24} color={colors.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.optionTitle}>{t('ai.quickAdd')}</Text>
          <Text style={styles.optionSubtitle}>{t('ai.quickAddSubtitle')}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onSelectManual}
        style={({ pressed }) => [styles.optionCard, pressed && styles.pressed]}
      >
        <View style={styles.iconWrapManual}>
          <MaterialIcons name="add" size={24} color={colors.text} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.optionTitle}>{t('ai.manualAdd')}</Text>
          <Text style={styles.optionSubtitle}>{t('ai.manualAddSubtitle')}</Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'left',
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
  },
  iconWrapAi: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    marginRight: 14,
    width: 46,
  },
  iconWrapManual: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    marginRight: 14,
    width: 46,
  },
  textWrap: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  optionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 14,
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
