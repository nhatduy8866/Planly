import type { PlannerState, Task } from '../types';
import { timeToMinutes } from '../utils/date';

export const initialPlannerState: PlannerState = {
  tasks: [],
  hydrated: false,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export type PlannerAction =
  | { type: 'hydrate'; payload: Pick<PlannerState, 'tasks'> }
  | { type: 'replace_from_sync'; payload: Pick<PlannerState, 'tasks'> }
  | { type: 'upsert_task'; payload: Task }
  | { type: 'upsert_tasks'; payload: Task[] }
  | {
      type: 'sync_notification_ids';
      payload: { id: string; notificationId: string | undefined }[];
    }
  | { type: 'create_batch_tasks'; payload: Task[] }
  | {
      type: 'rollback_task_batch';
      payload: { savedIds: string[]; previousTasks: Task[] };
    }
  | { type: 'delete_task'; payload: { id: string } }
  | { type: 'delete_tasks'; payload: { ids: string[] } }
  | { type: 'toggle_task'; payload: { id: string } }
  | { type: 'move_task'; payload: { id: string; direction: -1 | 1 } }
  | { type: 'sort_day'; payload: { date: string; by?: 'time' | 'title' | 'priority' } };

function applyTaskOrders(
  state: PlannerState,
  orderById: ReadonlyMap<string, number>,
): PlannerState {
  let changed = false;
  const tasks = state.tasks.map((task) => {
    const order = orderById.get(task.id);
    if (order === undefined || order === task.order) return task;
    changed = true;
    return { ...task, order };
  });

  return changed ? { ...state, tasks } : state;
}

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case 'hydrate':
      return {
        tasks: action.payload.tasks,
        hydrated: true,
      };
    case 'replace_from_sync':
      return {
        ...state,
        tasks: action.payload.tasks,
      };
    case 'upsert_task': {
      const index = state.tasks.findIndex(
        (task) => task.id === action.payload.id,
      );
      if (index < 0) {
        return { ...state, tasks: [...state.tasks, action.payload] };
      }
      if (state.tasks[index] === action.payload) return state;

      const tasks = [...state.tasks];
      tasks[index] = action.payload;
      return { ...state, tasks };
    }
    case 'upsert_tasks': {
      if (!action.payload.length) return state;
      const updatesById = new Map(
        action.payload.map((task) => [task.id, task]),
      );
      const existingIds = new Set(state.tasks.map((task) => task.id));
      const tasks = state.tasks.map(
        (task) => updatesById.get(task.id) ?? task,
      );

      for (const task of action.payload) {
        if (!existingIds.has(task.id)) tasks.push(task);
      }

      return { ...state, tasks };
    }
    case 'sync_notification_ids': {
      if (!action.payload.length) return state;
      const updatesById = new Map(
        action.payload.map((update) => [update.id, update.notificationId]),
      );
      let changed = false;
      const tasks = state.tasks.map((task) => {
        if (!updatesById.has(task.id)) return task;
        const notificationId = updatesById.get(task.id);
        if (task.notificationId === notificationId) return task;
        changed = true;
        return { ...task, notificationId };
      });
      return changed ? { ...state, tasks } : state;
    }
    case 'create_batch_tasks': {
      if (!action.payload.length) return state;
      const newIds = new Set(action.payload.map((t) => t.id));
      const remainingTasks = state.tasks.filter((t) => !newIds.has(t.id));
      return { ...state, tasks: [...remainingTasks, ...action.payload] };
    }
    case 'rollback_task_batch': {
      const savedIds = new Set(action.payload.savedIds);
      const previousById = new Map(
        action.payload.previousTasks.map((task) => [task.id, task]),
      );
      const restoredIds = new Set<string>();
      const tasks: Task[] = [];

      for (const task of state.tasks) {
        if (!savedIds.has(task.id)) {
          tasks.push(task);
          continue;
        }
        const previous = previousById.get(task.id);
        if (previous) {
          tasks.push(previous);
          restoredIds.add(previous.id);
        }
      }

      for (const previous of action.payload.previousTasks) {
        if (!restoredIds.has(previous.id)) tasks.push(previous);
      }

      return { ...state, tasks };
    }
    case 'delete_task': {
      const index = state.tasks.findIndex(
        (task) => task.id === action.payload.id,
      );
      if (index < 0) return state;
      return {
        ...state,
        tasks: [
          ...state.tasks.slice(0, index),
          ...state.tasks.slice(index + 1),
        ],
      };
    }
    case 'delete_tasks': {
      if (!action.payload.ids.length) return state;
      const deletedIds = new Set(action.payload.ids);
      const tasks = state.tasks.filter((task) => !deletedIds.has(task.id));
      return tasks.length === state.tasks.length ? state : { ...state, tasks };
    }
    case 'toggle_task': {
      const index = state.tasks.findIndex(
        (task) => task.id === action.payload.id,
      );
      if (index < 0) return state;

      const tasks = [...state.tasks];
      const task = tasks[index];
      tasks[index] = {
        ...task,
        completed: !task.completed,
        updatedAt: new Date().toISOString(),
      };
      return { ...state, tasks };
    }
    case 'move_task': {
      const current = state.tasks.find((task) => task.id === action.payload.id);
      if (!current) return state;
      const dayTasks = state.tasks
        .filter((task) => task.date === current.date)
        .sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            a.createdAt.localeCompare(b.createdAt),
        );
      const currentIndex = dayTasks.findIndex((task) => task.id === current.id);
      if (currentIndex === -1) return state;
      const targetIndex = currentIndex + action.payload.direction;
      if (targetIndex < 0 || targetIndex >= dayTasks.length) return state;

      const itemToMove = dayTasks[currentIndex];
      dayTasks.splice(currentIndex, 1);
      dayTasks.splice(targetIndex, 0, itemToMove);

      const orderById = new Map<string, number>();
      dayTasks.forEach((task, order) => {
        orderById.set(task.id, order);
      });
      return applyTaskOrders(state, orderById);
    }
    case 'sort_day': {
      const by = action.payload.by ?? 'time';
      const sortedDay = state.tasks
        .filter((task) => task.date === action.payload.date)
        .sort((a, b) => {
          if (by === 'priority') {
            const weightA = PRIORITY_WEIGHT[a.priority ?? 'none'] ?? 0;
            const weightB = PRIORITY_WEIGHT[b.priority ?? 'none'] ?? 0;
            return (
              weightB - weightA ||
              timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
              (a.order ?? 0) - (b.order ?? 0)
            );
          }
          if (by === 'title') {
            return (
              a.title.localeCompare(b.title, 'vi-VN') ||
              timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
              (a.order ?? 0) - (b.order ?? 0)
            );
          }
          return (
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
            (a.order ?? 0) - (b.order ?? 0) ||
            a.createdAt.localeCompare(b.createdAt)
          );
        });
      const orderById = new Map<string, number>();
      sortedDay.forEach((task, order) => {
        orderById.set(task.id, order);
      });
      return applyTaskOrders(state, orderById);
    }
    default:
      return state;
  }
}
