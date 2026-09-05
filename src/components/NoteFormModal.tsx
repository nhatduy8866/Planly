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

import { colors } from '../theme/colors';
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
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [error, setError] = useState('');

  function handleSubmit() {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) {
      setError('Hãy nhập tiêu đề hoặc nội dung ghi chú.');
      return;
    }
    onSubmit({
      title: cleanTitle || 'Ghi chú không tiêu đề',
      content: cleanContent,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <IconButton
            icon="close"
            accessibilityLabel="Đóng"
            onPress={onClose}
            backgroundColor="transparent"
          />
          <Text style={styles.headerTitle}>{note ? 'Sửa ghi chú' : 'Ghi chú mới'}</Text>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          >
            <Text style={styles.saveText}>Lưu</Text>
          </Pressable>
        </View>
        <View style={styles.form}>
          <TextInput
            autoFocus={!note}
            maxLength={120}
            onChangeText={setTitle}
            placeholder="Tiêu đề"
            placeholderTextColor="#9AA19B"
            style={styles.titleInput}
            value={title}
          />
          <TextInput
            maxLength={5000}
            multiline
            onChangeText={setContent}
            placeholder="Viết ghi chú của bạn..."
            placeholderTextColor="#9AA19B"
            style={styles.contentInput}
            textAlignVertical="top"
            value={content}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
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
