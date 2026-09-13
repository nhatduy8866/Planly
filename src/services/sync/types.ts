import type { Note, Task } from '../../types';

export type SyncedTask = Omit<Task, 'notificationId'>;
export type SyncEntity = 'note' | 'task';

interface SyncMutationBase {
  changedAt: string;
  id: string;
  mutationId: string;
  ownerId?: string;
}

export type SyncMutation =
  | (SyncMutationBase & {
      entity: 'task';
      operation: 'upsert';
      record: SyncedTask;
    })
  | (SyncMutationBase & {
      entity: 'note';
      operation: 'upsert';
      record: Note;
    })
  | (SyncMutationBase & {
      entity: SyncEntity;
      operation: 'delete';
    });

export interface RemoteRecord<T> {
  changedAt: string;
  deletedAt: string | null;
  id: string;
  record: T | null;
}

export interface CloudPlannerSnapshot {
  notes: RemoteRecord<Note>[];
  tasks: RemoteRecord<SyncedTask>[];
}

export function createMutationId(): string {
  return `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function taskForSync(task: Task): SyncedTask {
  const { notificationId: _notificationId, ...syncedTask } = task;
  return syncedTask;
}

export function createTaskUpsertMutation(
  task: Task | SyncedTask,
  changedAt = new Date().toISOString(),
  ownerId?: string,
): SyncMutation {
  const record = 'notificationId' in task ? taskForSync(task) : task;
  return {
    changedAt,
    entity: 'task',
    id: record.id,
    mutationId: createMutationId(),
    operation: 'upsert',
    ownerId,
    record: { ...record, updatedAt: changedAt },
  };
}

export function createNoteUpsertMutation(
  note: Note,
  changedAt = new Date().toISOString(),
  ownerId?: string,
): SyncMutation {
  return {
    changedAt,
    entity: 'note',
    id: note.id,
    mutationId: createMutationId(),
    operation: 'upsert',
    ownerId,
    record: { ...note, updatedAt: changedAt },
  };
}

export function createDeleteMutation(
  entity: SyncEntity,
  id: string,
  changedAt = new Date().toISOString(),
  ownerId?: string,
): SyncMutation {
  return {
    changedAt,
    entity,
    id,
    mutationId: createMutationId(),
    operation: 'delete',
    ownerId,
  };
}
