import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConfirmModal } from '../components/ConfirmModal';
import { EmptyState } from '../components/EmptyState';
import { IconButton } from '../components/IconButton';
import {
  NoteFormModal,
  type NoteFormValues,
} from '../components/NoteFormModal';
import { usePreferences } from '../preferences/PreferencesContext';
import { usePlanner } from '../store/PlannerContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Note } from '../types';
import { createId } from '../utils/id';

function formatUpdatedAt(value: string, locale: 'vi-VN' | 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function NotesScreen() {
  const { state, dispatch } = usePlanner();
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | undefined>();
  const [deletingNote, setDeletingNote] = useState<Note | undefined>();

  const notes = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return state.notes
      .filter((note) =>
        normalizedQuery
          ? `${note.title} ${note.content}`
              .toLocaleLowerCase(locale)
              .includes(normalizedQuery)
          : true,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [locale, query, state.notes]);

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
    setDeletingNote(note);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={21} color={colors.textMuted} />
            <TextInput
              onChangeText={setQuery}
              placeholder={t('notes.search')}
              placeholderTextColor={colors.placeholder}
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <MaterialIcons name="cancel" size={19} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={openCreate} style={styles.addButton}>
            <MaterialIcons name="add" size={21} color={colors.white} />
            <Text style={styles.addText}>{t('common.add')}</Text>
          </Pressable>
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
                    accessibilityLabel={t('notes.deleteLabel')}
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
                    {t('notes.updated', { date: formatUpdatedAt(note.updatedAt, locale) })}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="sticky-note-2"
            title={t(query ? 'notes.noResultsTitle' : 'notes.emptyTitle')}
            description={t(
              query ? 'notes.noResultsDescription' : 'notes.emptyDescription',
            )}
            actionLabel={query ? undefined : t('notes.create')}
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

      <ConfirmModal
        visible={Boolean(deletingNote)}
        title={t('notes.deleteTitle')}
        message={t('notes.deleteMessage', { title: deletingNote?.title ?? '' })}
        onConfirm={() => {
          if (deletingNote) {
            dispatch({ type: 'delete_note', payload: { id: deletingNote.id } });
            setDeletingNote(undefined);
          }
        }}
        onCancel={() => setDeletingNote(undefined)}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 32, paddingHorizontal: 16, paddingTop: 14 },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
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
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 13,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 14, paddingHorizontal: 9, paddingVertical: 12 },
  searchRow: { flexDirection: 'row', gap: 10 },
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
