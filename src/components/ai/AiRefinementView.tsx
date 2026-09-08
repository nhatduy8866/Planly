import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { usePreferences } from '../../preferences/PreferencesContext';
import type { ThemeColors } from '../../theme/colors';
import { useThemedStyles } from '../../theme/useThemedStyles';

interface AiRefinementViewProps {
  onSubmit: (instruction: string) => void;
  onBack: () => void;
}

export function AiRefinementView({ onSubmit, onBack }: AiRefinementViewProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [instruction, setInstruction] = useState('');
  const refinementChips = [
    { id: 'move', icon: 'access-time', text: t('ai.refineMove') },
    { id: 'remind', icon: 'notifications-none', text: t('ai.refineRemind') },
    { id: 'remove', icon: 'delete-outline', text: t('ai.refineRemove') },
    { id: 'add', icon: 'auto-awesome', text: t('ai.refineAdd') },
  ];

  function handleSelectChip(chipText: string) {
    void Haptics.selectionAsync();
    setInstruction(chipText);
  }

  function handleSend() {
    if (!instruction.trim()) return;
    onSubmit(instruction.trim());
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('ai.refineTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.guideTitle}>{t('ai.refineGuide')}</Text>

        <View style={styles.chipList}>
          {refinementChips.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleSelectChip(item.text)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <MaterialIcons name={item.icon as any} size={16} color={colors.primary} />
              <Text style={styles.chipText}>{item.text}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Chat Bar */}
      <View style={styles.chatBarContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            onChangeText={setInstruction}
            placeholder={t('ai.refinePlaceholder')}
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={instruction}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={styles.micBtn}>
            <MaterialIcons name="mic-none" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <Pressable
          disabled={!instruction.trim()}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendBtn,
            !instruction.trim() && styles.sendBtnDisabled,
            pressed && instruction.trim() ? styles.pressed : null,
          ]}
        >
          <MaterialIcons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  guideTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  chipList: {
    gap: 10,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chatBarContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 24,
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    height: 44,
  },
  micBtn: {
    padding: 6,
  },
  sendBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});
