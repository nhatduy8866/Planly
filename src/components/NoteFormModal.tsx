import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Note } from '../types';
import { IconButton } from './IconButton';

export interface NoteFormValues {
  title: string;
  content: string;
}

interface NoteFormModalProps {
  visible: boolean;
  note?: Note;
  onClose: () => void;
  onSubmit: (values: NoteFormValues) => void;
}

export function NoteFormModal({
  visible,
  note,
  onClose,
  onSubmit,
}: NoteFormModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [error, setError] = useState('');

  function handleSubmit() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) {
      setError(t('notes.validation'));
      return;
    }
    onSubmit({
      title: cleanTitle || t('notes.untitled'),
      content: cleanContent,
    });
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={Platform.OS === 'web'}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <View style={[styles.header, { paddingTop: Platform.OS === 'web' ? 16 : Math.max(insets.top, 16) }]}>
              <IconButton
                icon="close"
                accessibilityLabel={t('common.close')}
                onPress={onClose}
                backgroundColor="transparent"
              />
              <Text style={styles.headerTitle}>
                {t(note ? 'notes.editTitle' : 'notes.newTitle')}
              </Text>
              <Pressable
                onPress={handleSubmit}
                style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              >
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </Pressable>
            </View>
            <View style={styles.form}>
              <TextInput
                autoFocus={!note}
                maxLength={120}
                onChangeText={setTitle}
                placeholder={t('notes.titlePlaceholder')}
                placeholderTextColor={colors.placeholder}
                style={styles.titleInput}
                value={title}
              />
              <TextInput
                maxLength={5000}
                multiline
                onChangeText={setContent}
                placeholder={t('notes.contentPlaceholder')}
                placeholderTextColor={colors.placeholder}
                style={styles.contentInput}
                textAlignVertical="top"
                value={content}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalBackdrop: {
    backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.background,
    flex: Platform.OS === 'web' ? undefined : 1,
    width: Platform.OS === 'web' ? '92%' : '100%',
    maxWidth: Platform.OS === 'web' ? 480 : undefined,
    height: Platform.OS === 'web' ? '80%' : '100%',
    maxHeight: Platform.OS === 'web' ? 620 : undefined,
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: colors.border,
  },
  keyboardWrap: { flex: 1, width: '100%' },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '800' },
  saveButton: { paddingHorizontal: 8, paddingVertical: 10 },
  saveText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  form: { flex: 1, padding: 20 },
  titleInput: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    paddingBottom: 14,
  },
  contentInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    paddingTop: 18,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  pressed: { opacity: 0.7 },
});
