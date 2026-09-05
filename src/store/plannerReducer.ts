import type { Note, PlannerState, Task } from '../types';
import { timeToMinutes } from '../utils/date';

export const initialPlannerState: PlannerState = {
  tasks: [],
  notes: [],
  hydrated: false,
};

export type PlannerAction =
  | { type: 'hydrate'; payload: Pick<PlannerState, 'tasks' | 'notes'> }
  | { type: 'upsert_task'; payload: Task }
  | { type: 'delete_task'; payload: { id: string } }
  | { type: 'toggle_task'; payload: { id: string } }
  | { type: 'move_task'; payload: { id: string; direction: -1 | 1 } }
  | { type: 'sort_day'; payload: { date: string } }
  | { type: 'upsert_note'; payload: Note }
  | { type: 'delete_note'; payload: { id: string } };

function normalizeDayOrder(tasks: Task[], date: string): Task[] {
  const dayTasks = tasks
    .filter((task) => task.date === date)
    .sort((a, b) => a.order - b.order)
    .map((task, order) => ({ ...task, order }));
  const normalized = new Map(dayTasks.map((task) => [task.id, task]));
  return tasks.map((task) => normalized.get(task.id) ?? task);
}

export function plannerReducer(
  state: PlannerState,
  action: PlannerAction,
): PlannerState {
  switch (action.type) {
    case 'hydrate':
      return {
        tasks: action.payload.tasks,
        notes: action.payload.notes,
        hydrated: true,
      };
    case 'upsert_task': {
      const exists = state.tasks.some((task) => task.id === action.payload.id);
      const tasks = exists
        ? state.tasks.map((task) =>
            task.id === action.payload.id ? action.payload : task,
          )
        : [...state.tasks, action.payload];
      return { ...state, tasks };
    }
    case 'delete_task':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.payload.id),
      };
    case 'toggle_task':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.id
            ? {
                ...task,
                completed: !task.completed,
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
      };
    case 'move_task': {
      const current = state.tasks.find((task) => task.id === action.payload.id);
      if (!current) return state;
      const dayTasks = state.tasks
        .filter((task) => task.date === current.date)
        .sort((a, b) => a.order - b.order);
      const currentIndex = dayTasks.findIndex((task) => task.id === current.id);
      const targetIndex = currentIndex + action.payload.direction;
      if (targetIndex < 0 || targetIndex >= dayTasks.length) return state;
      [dayTasks[currentIndex], dayTasks[targetIndex]] = [
        dayTasks[targetIndex],
        dayTasks[currentIndex],
      ];
      const orderById = new Map(
        dayTasks.map((task, order) => [task.id, order] as const),
      );
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          orderById.has(task.id)
            ? { ...task, order: orderById.get(task.id)! }
            : task,
        ),
      };
    }
    case 'sort_day': {
      const sortedDay = state.tasks
        .filter((task) => task.date === action.payload.date)
        .sort(
          (a, b) =>
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
            a.order - b.order,
        );
      const orderById = new Map(
        sortedDay.map((task, order) => [task.id, order] as const),
      );
      return {
        ...state,
        tasks: normalizeDayOrder(
          state.tasks.map((task) =>
            orderById.has(task.id)
              ? { ...task, order: orderById.get(task.id)! }
              : task,
          ),
          action.payload.date,
        ),
      };
    }
    case 'upsert_note': {
      const exists = state.notes.some((note) => note.id === action.payload.id);
      return {
        ...state,
        notes: exists
          ? state.notes.map((note) =>
              note.id === action.payload.id ? action.payload : note,
            )
          : [action.payload, ...state.notes],
      };
    }
    case 'delete_note':
      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== action.payload.id),
      };
    default:
      return state;
  }
}
