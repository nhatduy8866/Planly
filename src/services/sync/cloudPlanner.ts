import type { SupabaseClient } from '@supabase/supabase-js';

import type { Note, TaskPriority } from '../../types';
import type {
  CloudPlannerSnapshot,
  RemoteRecord,
  SyncMutation,
  SyncedTask,
} from './types';

interface TaskRow {
  batch_id: string | null;
  color: string | null;
  completed: boolean | null;
  created_at: string | null;
  date: string | null;
  deleted_at: string | null;
  description: string | null;
  id: string;
  order_index: number | null;
  priority: string | null;
  reminder_minutes: number | null;
  start_time: string | null;
  title: string | null;
  updated_at: string;
}

interface NoteRow {
  content: string | null;
  created_at: string | null;
  deleted_at: string | null;
  id: string;
  title: string | null;
  updated_at: string;
}

const TASK_COLUMNS = [
  'id',
  'title',
  'description',
  'date',
  'start_time',
  'reminder_minutes',
  'color',
  'batch_id',
  'completed',
  'order_index',
  'priority',
  'created_at',
  'updated_at',
  'deleted_at',
].join(',');

const NOTE_COLUMNS = [
  'id',
  'title',
  'content',
  'created_at',
  'updated_at',
  'deleted_at',
].join(',');

function isTaskPriority(value: string | null): value is TaskPriority {
  return (
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'none'
  );
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function taskFromRow(row: TaskRow): RemoteRecord<SyncedTask> {
  const deleted = row.deleted_at !== null;
  const hasLiveData =
    row.title !== null &&
    row.description !== null &&
    row.date !== null &&
    row.start_time !== null &&
    row.completed !== null &&
    row.order_index !== null &&
    row.created_at !== null;

  return {
    changedAt: normalizeTimestamp(row.updated_at),
    deletedAt: row.deleted_at ? normalizeTimestamp(row.deleted_at) : null,
    id: row.id,
    record:
      deleted || !hasLiveData
        ? null
        : {
            batchId: row.batch_id ?? undefined,
            color: row.color ?? undefined,
            completed: row.completed!,
            createdAt: row.created_at!,
            date: row.date!,
            description: row.description!,
            id: row.id,
            order: row.order_index!,
            priority: isTaskPriority(row.priority) ? row.priority : undefined,
            reminderMinutes: row.reminder_minutes,
            startTime: row.start_time!,
            title: row.title!,
            updatedAt: normalizeTimestamp(row.updated_at),
          },
  };
}

function noteFromRow(row: NoteRow): RemoteRecord<Note> {
  const deleted = row.deleted_at !== null;
  const hasLiveData =
    row.title !== null &&
    row.content !== null &&
    row.created_at !== null;

  return {
    changedAt: normalizeTimestamp(row.updated_at),
    deletedAt: row.deleted_at ? normalizeTimestamp(row.deleted_at) : null,
    id: row.id,
    record:
      deleted || !hasLiveData
        ? null
        : {
            content: row.content!,
            createdAt: row.created_at!,
            id: row.id,
            title: row.title!,
            updatedAt: normalizeTimestamp(row.updated_at),
          },
  };
}

export async function fetchCloudPlannerSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<CloudPlannerSnapshot> {
  const [tasksResult, notesResult] = await Promise.all([
    client
      .from('planly_tasks')
      .select(TASK_COLUMNS)
      .eq('user_id', userId),
    client
      .from('planly_notes')
      .select(NOTE_COLUMNS)
      .eq('user_id', userId),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (notesResult.error) throw notesResult.error;

  return {
    notes: ((notesResult.data ?? []) as unknown as NoteRow[]).map(noteFromRow),
    tasks: ((tasksResult.data ?? []) as unknown as TaskRow[]).map(taskFromRow),
  };
}

function taskMutationRow(mutation: SyncMutation, userId: string) {
  if (mutation.entity !== 'task') return undefined;
  if (mutation.operation === 'delete') {
    return {
      batch_id: null,
      color: null,
      completed: null,
      created_at: null,
      date: null,
      deleted_at: mutation.changedAt,
      description: null,
      id: mutation.id,
      order_index: null,
      priority: null,
      reminder_minutes: null,
      start_time: null,
      title: null,
      updated_at: mutation.changedAt,
      user_id: userId,
    };
  }

  return {
    batch_id: mutation.record.batchId ?? null,
    color: mutation.record.color ?? null,
    completed: mutation.record.completed,
    created_at: mutation.record.createdAt,
    date: mutation.record.date,
    deleted_at: null,
    description: mutation.record.description,
    id: mutation.record.id,
    order_index: mutation.record.order,
    priority: mutation.record.priority ?? null,
    reminder_minutes: mutation.record.reminderMinutes,
    start_time: mutation.record.startTime,
    title: mutation.record.title,
    updated_at: mutation.changedAt,
    user_id: userId,
  };
}

function noteMutationRow(mutation: SyncMutation, userId: string) {
  if (mutation.entity !== 'note') return undefined;
  if (mutation.operation === 'delete') {
    return {
      content: null,
      created_at: null,
      deleted_at: mutation.changedAt,
      id: mutation.id,
      title: null,
      updated_at: mutation.changedAt,
      user_id: userId,
    };
  }

  return {
    content: mutation.record.content,
    created_at: mutation.record.createdAt,
    deleted_at: null,
    id: mutation.record.id,
    title: mutation.record.title,
    updated_at: mutation.changedAt,
    user_id: userId,
  };
}

export async function pushCloudPlannerMutations(
  client: SupabaseClient,
  userId: string,
  mutations: SyncMutation[],
): Promise<void> {
  const taskRows = mutations
    .map((mutation) => taskMutationRow(mutation, userId))
    .filter((row) => row !== undefined);
  const noteRows = mutations
    .map((mutation) => noteMutationRow(mutation, userId))
    .filter((row) => row !== undefined);

  const results = await Promise.all([
    taskRows.length > 0
      ? client.from('planly_tasks').upsert(taskRows, {
          onConflict: 'user_id,id',
        })
      : Promise.resolve({ error: null }),
    noteRows.length > 0
      ? client.from('planly_notes').upsert(noteRows, {
          onConflict: 'user_id,id',
        })
      : Promise.resolve({ error: null }),
  ]);

  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
}
