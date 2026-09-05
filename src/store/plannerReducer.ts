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
  | { type: 'sort_day'; payload: { date: string; by?: 'time' | 'title' } }
  | { type: 'upsert_note'; payload: Note }
  | { type: 'delete_note'; payload: { id: string } };


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
      const by = action.payload.by ?? 'time';
      const sortedDay = state.tasks
        .filter((task) => task.date === action.payload.date)
        .sort((a, b) => {
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
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          orderById.has(task.id)
            ? { ...task, order: orderById.get(task.id)! }
            : task,
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
