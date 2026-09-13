import type { Note, Task } from '../../types';
import {
  createDeleteMutation,
  createNoteUpsertMutation,
  createTaskUpsertMutation,
  taskForSync,
  type CloudPlannerSnapshot,
  type RemoteRecord,
  type SyncEntity,
  type SyncMutation,
  type SyncedTask,
} from './types';

export interface PlannerSyncMergeResult {
  consumedMutations: SyncMutation[];
  mutationsToPush: SyncMutation[];
  notes: Note[];
  tasks: Task[];
}

interface MergeCollectionResult<T> {
  mutationsToPush: SyncMutation[];
  records: T[];
}

function compareChangedAt(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  return left.localeCompare(right);
}

function mutationMap(
  mutations: SyncMutation[],
  entity: SyncEntity,
): Map<string, SyncMutation> {
  return new Map(
    mutations
      .filter((mutation) => mutation.entity === entity)
      .map((mutation) => [mutation.id, mutation]),
  );
}

function mergeCollection<T extends { id: string; updatedAt: string }>(
  entity: SyncEntity,
  localRecords: T[],
  remoteRecords: RemoteRecord<T>[],
  queuedMutations: SyncMutation[],
  createUpsert: (record: T, changedAt: string) => SyncMutation,
  getQueuedRecord: (mutation: SyncMutation | undefined) => T | undefined,
  updateQueuedRecord: (mutation: SyncMutation, record: T) => SyncMutation,
): MergeCollectionResult<T> {
  const localById = new Map(localRecords.map((record) => [record.id, record]));
  const remoteById = new Map(remoteRecords.map((record) => [record.id, record]));
  const queuedById = mutationMap(queuedMutations, entity);
  const ids = new Set([
    ...localById.keys(),
    ...remoteById.keys(),
    ...queuedById.keys(),
  ]);
  const records: T[] = [];
  const mutationsToPush: SyncMutation[] = [];

  for (const id of ids) {
    const queued = queuedById.get(id);
    const remote = remoteById.get(id);
    const local = localById.get(id);
    const remoteChangedAt = remote?.changedAt;

    if (queued?.operation === 'delete') {
      if (
        remoteChangedAt === undefined ||
        compareChangedAt(queued.changedAt, remoteChangedAt) >= 0
      ) {
        mutationsToPush.push(queued);
        continue;
      }
      if (remote?.record) records.push(remote.record);
      continue;
    }

    const queuedRecord = getQueuedRecord(queued);
    const localCandidate = queuedRecord ?? local;
    const localChangedAt = queued?.changedAt ?? localCandidate?.updatedAt;

    if (!localCandidate || !localChangedAt) {
      if (remote?.record) records.push(remote.record);
      continue;
    }

    const localWinner =
      remoteChangedAt === undefined ||
      compareChangedAt(localChangedAt, remoteChangedAt) > 0;

    if (localWinner) {
      const winningRecord = {
        ...localCandidate,
        updatedAt: localChangedAt,
      };
      records.push(winningRecord);
      mutationsToPush.push(
        queued?.operation === 'upsert' && queuedRecord
          ? updateQueuedRecord(queued, winningRecord)
          : createUpsert(winningRecord, localChangedAt),
      );
    } else if (remote?.record) {
      records.push(remote.record);
    }
  }

  return { mutationsToPush, records };
}

function taskRecordFromMutation(
  mutation: SyncMutation | undefined,
): SyncedTask | undefined {
  return mutation?.entity === 'task' && mutation.operation === 'upsert'
    ? mutation.record
    : undefined;
}

function noteRecordFromMutation(
  mutation: SyncMutation | undefined,
): Note | undefined {
  return mutation?.entity === 'note' && mutation.operation === 'upsert'
    ? mutation.record
    : undefined;
}

function updateTaskMutationRecord(
  mutation: SyncMutation,
  record: SyncedTask,
): SyncMutation {
  return mutation.entity === 'task' && mutation.operation === 'upsert'
    ? { ...mutation, record }
    : createTaskUpsertMutation(record, record.updatedAt);
}

function updateNoteMutationRecord(
  mutation: SyncMutation,
  record: Note,
): SyncMutation {
  return mutation.entity === 'note' && mutation.operation === 'upsert'
    ? { ...mutation, record }
    : createNoteUpsertMutation(record, record.updatedAt);
}

export function mergePlannerSnapshots(
  localTasks: Task[],
  localNotes: Note[],
  remote: CloudPlannerSnapshot,
  queuedMutations: SyncMutation[],
): PlannerSyncMergeResult {
  const localTaskById = new Map(localTasks.map((task) => [task.id, task]));
  const tasks = mergeCollection<SyncedTask>(
    'task',
    localTasks.map(taskForSync),
    remote.tasks,
    queuedMutations,
    createTaskUpsertMutation,
    taskRecordFromMutation,
    updateTaskMutationRecord,
  );
  const notes = mergeCollection<Note>(
    'note',
    localNotes,
    remote.notes,
    queuedMutations,
    createNoteUpsertMutation,
    noteRecordFromMutation,
    updateNoteMutationRecord,
  );

  return {
    consumedMutations: queuedMutations,
    mutationsToPush: tasks.mutationsToPush.concat(notes.mutationsToPush),
    notes: notes.records,
    tasks: tasks.records.map((task) => ({
      ...task,
      notificationId: localTaskById.get(task.id)?.notificationId,
    })),
  };
}

export function diffPlannerData(
  previousTasks: Task[],
  previousNotes: Note[],
  currentTasks: Task[],
  currentNotes: Note[],
  changedAt = new Date().toISOString(),
  ownerId?: string,
): SyncMutation[] {
  const mutations: SyncMutation[] = [];
  const previousTasksById = new Map(previousTasks.map((task) => [task.id, task]));
  const currentTasksById = new Map(currentTasks.map((task) => [task.id, task]));
  const previousNotesById = new Map(previousNotes.map((note) => [note.id, note]));
  const currentNotesById = new Map(currentNotes.map((note) => [note.id, note]));

  for (const task of currentTasks) {
    const previous = previousTasksById.get(task.id);
    if (JSON.stringify(taskForSync(previous ?? task)) !== JSON.stringify(taskForSync(task))) {
      mutations.push(createTaskUpsertMutation(task, changedAt, ownerId));
    } else if (!previous) {
      mutations.push(createTaskUpsertMutation(task, changedAt, ownerId));
    }
  }
  for (const id of previousTasksById.keys()) {
    if (!currentTasksById.has(id)) {
      mutations.push(createDeleteMutation('task', id, changedAt, ownerId));
    }
  }

  for (const note of currentNotes) {
    const previous = previousNotesById.get(note.id);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(note)) {
      mutations.push(createNoteUpsertMutation(note, changedAt, ownerId));
    }
  }
  for (const id of previousNotesById.keys()) {
    if (!currentNotesById.has(id)) {
      mutations.push(createDeleteMutation('note', id, changedAt, ownerId));
    }
  }

  return mutations;
}
