import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SyncMutation } from './types';

const OUTBOX_STORAGE_KEY = '@planly/sync/outbox/v1';

let storageQueue: Promise<void> = Promise.resolve();

type MutationIdentity = Pick<SyncMutation, 'entity' | 'id' | 'ownerId'>;

function mutationKey(mutation: MutationIdentity): string {
  return `${mutation.ownerId ?? 'unowned'}:${mutation.entity}:${mutation.id}`;
}

function isSyncMutation(value: unknown): value is SyncMutation {
  if (!value || typeof value !== 'object') return false;
  const mutation = value as Partial<SyncMutation>;
  const hasBaseFields =
    typeof mutation.changedAt === 'string' &&
    (mutation.entity === 'task' || mutation.entity === 'note') &&
    typeof mutation.id === 'string' &&
    typeof mutation.mutationId === 'string' &&
    (mutation.ownerId === undefined || typeof mutation.ownerId === 'string');
  if (!hasBaseFields) return false;
  if (mutation.operation === 'delete') return true;
  if (
    mutation.operation !== 'upsert' ||
    mutation.record === null ||
    typeof mutation.record !== 'object'
  ) return false;
  const record = mutation.record as { id?: unknown; updatedAt?: unknown };
  return (
    record.id === mutation.id &&
    typeof record.updatedAt === 'string'
  );
}

async function readOutboxDirect(): Promise<SyncMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSyncMutation) : [];
  } catch {
    return [];
  }
}

function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function readSyncOutbox(ownerId?: string): Promise<SyncMutation[]> {
  await storageQueue;
  const mutations = await readOutboxDirect();
  return ownerId
    ? mutations.filter((mutation) => mutation.ownerId === ownerId)
    : mutations;
}

export function enqueueSyncMutations(
  mutations: SyncMutation[],
): Promise<SyncMutation[]> {
  if (mutations.length === 0) return readSyncOutbox();

  return runSerialized(async () => {
    const current = await readOutboxDirect();
    const byRecord = new Map(current.map((item) => [mutationKey(item), item]));
    for (const mutation of mutations) {
      byRecord.set(mutationKey(mutation), mutation);
    }
    const next = Array.from(byRecord.values());
    await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

export function removeProcessedSyncMutations(
  processed: Pick<
    SyncMutation,
    'entity' | 'id' | 'mutationId' | 'ownerId'
  >[],
): Promise<SyncMutation[]> {
  if (processed.length === 0) return readSyncOutbox();

  return runSerialized(async () => {
    const expectedIds = new Map(
      processed.map((item) => [
        mutationKey(item),
        item.mutationId,
      ]),
    );
    const current = await readOutboxDirect();
    const next = current.filter(
      (item) => expectedIds.get(mutationKey(item)) !== item.mutationId,
    );
    await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

export function clearSyncOutbox(): Promise<void> {
  return runSerialized(() => AsyncStorage.removeItem(OUTBOX_STORAGE_KEY));
}
