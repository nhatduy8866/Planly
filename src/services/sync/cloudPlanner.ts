import type { SupabaseClient } from '@supabase/supabase-js';

import type { TaskPriority } from '../../types';
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
  start_time: string | null;
  title: string | null;
  updated_at: string;
}

type TaskMutation = Extract<SyncMutation, { entity: 'task' }>;

const TASK_COLUMNS = [
  'id',
  'title',
  'description',
  'date',
  'start_time',
  'color',
  'batch_id',
  'completed',
  'order_index',
  'priority',
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
            startTime: row.start_time!,
            title: row.title!,
            updatedAt: normalizeTimestamp(row.updated_at),
          },
  };
}

export async function fetchCloudPlannerSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<CloudPlannerSnapshot> {
  const tasksResult = await client
    .from('planly_tasks')
    .select(TASK_COLUMNS)
    .eq('user_id', userId);

  if (tasksResult.error) throw tasksResult.error;

  return {
    tasks: ((tasksResult.data ?? []) as unknown as TaskRow[]).map(taskFromRow),
  };
}

function taskMutationRow(mutation: TaskMutation, userId: string) {
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
    start_time: mutation.record.startTime,
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
  const taskRows = [];
  for (const mutation of mutations) {
    if (mutation.entity === 'task') {
      taskRows.push(taskMutationRow(mutation, userId));
    }
  }
  if (taskRows.length === 0) return;

  const result = await client.from('planly_tasks').upsert(taskRows, {
    onConflict: 'user_id,id',
  });
  if (result.error) throw result.error;
}
