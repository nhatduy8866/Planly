import type { Task } from '../types';
import { taskDateTime, toDateKey } from './date';

export type ScheduleTaskView = 'upcoming' | 'past' | 'all';

export type ScheduleTaskGroups = Record<ScheduleTaskView, Task[]>;

export function getDefaultScheduleTaskView(
  selectedDate: string,
  now = new Date(),
): ScheduleTaskView {
  return selectedDate < toDateKey(now) ? 'all' : 'upcoming';
}

export function filterScheduleTasksForView(
  tasks: Task[],
  selectedDate: string,
  view: ScheduleTaskView,
  now = new Date(),
): Task[] {
  return tasks.filter((task) => {
    if (task.date !== selectedDate) return false;
    if (view === 'all') return true;
    const startTime = taskDateTime(task.date, task.startTime).getTime();

    return view === 'upcoming'
      ? !task.completed && startTime >= now.getTime()
      : task.completed || startTime < now.getTime();
  });
}

export function groupScheduleTasksForView(
  tasks: Task[],
  selectedDate: string,
  now = new Date(),
): ScheduleTaskGroups {
  const groups: ScheduleTaskGroups = { upcoming: [], past: [], all: [] };
  const currentTime = now.getTime();

  for (const task of tasks) {
    if (task.date !== selectedDate) continue;
    groups.all.push(task);

    const startTime = taskDateTime(task.date, task.startTime).getTime();
    if (!task.completed && startTime >= currentTime) {
      groups.upcoming.push(task);
    } else {
      groups.past.push(task);
    }
  }

  return groups;
}
