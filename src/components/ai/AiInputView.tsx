import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { useVoiceInput } from '../../hooks/useVoiceInput';

interface AiInputViewProps {
  initialPrompt?: string;
  infoMessage?: string | null;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

export function AiInputView({
  initialPrompt = '',
  infoMessage = null,
  onSubmit,
  onClose,
}: AiInputViewProps) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(initialPrompt);

  const {
    isRecording,
    isTranscribing,
    durationSeconds,
    errorMessage: voiceError,
    toggleRecording,
    clearError: clearVoiceError,
  } = useVoiceInput({
    onTranscript: (transcript) => {
      setText((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
    },
  });

  const quickPrompts = [
    { id: 'today', icon: 'auto-awesome', label: t('ai.suggestionToday'), prompt: t('ai.promptToday') },
    { id: 'tomorrow', icon: 'auto-awesome', label: t('ai.suggestionTomorrow'), prompt: t('ai.promptTomorrow') },
    { id: 'multi', icon: 'auto-awesome', label: t('ai.suggestionMultiple'), prompt: t('ai.promptMultiple') },
    { id: 'reorder', icon: 'refresh', label: t('ai.suggestionReorder'), prompt: t('ai.promptReorder') },
  ];

  function handleVoicePress() {
    clearVoiceError();
    toggleRecording();
  }

  function handleQuickPrompt(promptText: string) {
    void Haptics.selectionAsync();
    setText(promptText);
  }

  function handleFormSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim());
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconButton}>
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <View style={styles.logoRow}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>{t('ai.planly')}</Text>
          </View>
          <Text style={styles.headerSubtitle}>{t('ai.inputSubtitle')}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('ai.inputTitle')}</Text>
        <Text style={styles.description}>{t('ai.inputDescription')}</Text>

        {voiceError ? (
          <View style={styles.infoBanner}>
            <MaterialIcons name="error-outline" size={18} color={colors.warning} />
            <Text style={styles.infoBannerText}>{voiceError}</Text>
          </View>
        ) : null}

        {infoMessage ? (
          <View style={styles.infoBanner}>
            <MaterialIcons name="info-outline" size={18} color={colors.warning} />
            <Text style={styles.infoBannerText}>{infoMessage}</Text>
          </View>
        ) : null}

        {/* Input Card */}
        <View style={styles.inputCard}>
          <TextInput
            multiline
            numberOfLines={5}
            maxLength={1000}
            onChangeText={setText}
            placeholder={t('ai.inputPlaceholder')}
            placeholderTextColor={colors.placeholder}
            style={styles.textInput}
            value={text}
          />
          <View style={styles.inputFooter}>
            <Pressable
              disabled={isTranscribing}
              onPress={handleVoicePress}
              style={[
                styles.micButton,
                isRecording && styles.micButtonActive,
                isTranscribing && styles.micButtonProcessing,
              ]}
            >
              {isTranscribing ? (
                <>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.transcribingText}>{t('ai.voiceProcessing')}</Text>
                </>
              ) : isRecording ? (
                <>
                  <MaterialIcons name="mic" size={22} color={colors.danger} />
                  <Text style={styles.recordingText}>
                    {t('ai.voiceListening')} ({durationSeconds < 10 ? `0${durationSeconds}` : durationSeconds}s)
                  </Text>
                </>
              ) : (
                <MaterialIcons name="mic-none" size={22} color={colors.primary} />
              )}
            </Pressable>
            <Text style={styles.charCount}>{text.length}/1000</Text>
          </View>
        </View>

        {/* Gợi ý nhanh */}
        <Text style={styles.sectionLabel}>{t('ai.quickSuggestions')}</Text>
        <View style={styles.quickPromptsGrid}>
          {quickPrompts.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleQuickPrompt(item.prompt)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <MaterialIcons name={item.icon as any} size={15} color={colors.primary} />
              <Text style={styles.chipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer Submit Button */}
      <View style={styles.footer}>
        <Pressable
          disabled={!text.trim()}
          onPress={handleFormSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !text.trim() && styles.submitButtonDisabled,
            pressed && text.trim() ? styles.pressed : null,
          ]}
        >
          <MaterialIcons name="auto-awesome" size={20} color={colors.white} />
          <Text style={styles.submitText}>{t('ai.createPlan')}</Text>
        </Pressable>
      </View>
    </View>
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
  headerTitleWrap: {
    alignItems: 'center',
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 160,
    padding: 14,
  },
  textInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
  },
  micButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    padding: 6,
  },
  micButtonActive: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
  },
  micButtonProcessing: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
  },
  recordingText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  transcribingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  quickPromptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  infoBanner: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  infoBannerText: {
    color: colors.warning,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
