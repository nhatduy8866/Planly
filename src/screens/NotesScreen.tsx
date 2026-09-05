import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import {
  NoteFormModal,
  type NoteFormValues,
} from '../components/NoteFormModal';
import { usePlanner } from '../store/PlannerContext';
import { colors } from '../theme/colors';
import type { Note } from '../types';
import { createId } from '../utils/id';

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function NotesScreen() {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = usePlanner();
  const [query, setQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>();

  const notes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return state.notes
      .filter((note) =>
        normalizedQuery
          ? `${note.title} ${note.content}`
              .toLocaleLowerCase('vi-VN')
              .includes(normalizedQuery)
          : true,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [query, state.notes]);

  function openCreate() {
    setEditingNote(undefined);
    setFormVisible(true);
  }

  function handleSave(values: NoteFormValues) {
    const now = new Date().toISOString();
    dispatch({
      type: 'upsert_note',
      payload: {
        id: editingNote?.id ?? createId('note'),
        title: values.title,
        content: values.content,
        createdAt: editingNote?.createdAt ?? now,
        updatedAt: now,
      },
    });
  }

  function confirmDelete(note: Note) {
    Alert.alert('Xóa ghi chú?', `“${note.title}” sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => dispatch({ type: 'delete_note', payload: { id: note.id } }),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Ý TƯỞNG & THÔNG TIN</Text>
            <Text style={styles.screenTitle}>Ghi chú</Text>
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <MaterialIcons name="add" size={21} color={colors.white} />
            <Text style={styles.addText}>Thêm</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={21} color={colors.textMuted} />
          <TextInput
            onChangeText={setQuery}
            placeholder="Tìm ghi chú"
            placeholderTextColor="#969E97"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <MaterialIcons name="cancel" size={19} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {notes.length ? (
          <View style={styles.noteList}>
            {notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View style={styles.noteIcon}>
                    <MaterialIcons name="notes" size={19} color={colors.primary} />
                  </View>
                  <IconButton
                    icon="delete-outline"
                    accessibilityLabel="Xóa ghi chú"
                    onPress={() => confirmDelete(note)}
                    color={colors.danger}
                    backgroundColor="transparent"
                    size={19}
                    style={styles.deleteButton}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setEditingNote(note);
                    setFormVisible(true);
                  }}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text numberOfLines={2} style={styles.noteTitle}>
                    {note.title}
                  </Text>
                  {note.content ? (
                    <Text numberOfLines={4} style={styles.noteContent}>
                      {note.content}
                    </Text>
                  ) : null}
                  <Text style={styles.noteDate}>
                    Cập nhật {formatUpdatedAt(note.updatedAt)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="sticky-note-2"
            title={query ? 'Không tìm thấy ghi chú' : 'Chưa có ghi chú'}
            description={
              query
                ? 'Thử tìm bằng một từ khóa khác.'
                : 'Lưu lại ý tưởng hoặc thông tin bạn không muốn quên.'
            }
            actionLabel={query ? undefined : 'Tạo ghi chú'}
            onAction={query ? undefined : openCreate}
          />
        )}
      </ScrollView>

      {formVisible ? (
        <NoteFormModal
          visible
          note={editingNote}
          onClose={() => setFormVisible(false)}
          onSubmit={handleSave}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  screenTitle: { color: colors.text, fontSize: 29, fontWeight: '800', marginTop: 3 },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  addText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    paddingHorizontal: 13,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 14, paddingHorizontal: 9, paddingVertical: 12 },
  noteList: { gap: 11, marginTop: 18 },
  noteCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    padding: 15,
  },
  noteHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  noteIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  deleteButton: { height: 34, width: 34 },
  noteTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 11 },
  noteContent: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  noteDate: { color: colors.textMuted, fontSize: 11, marginTop: 14 },
  pressed: { opacity: 0.72 },
});
