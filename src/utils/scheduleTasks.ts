import type { Task } from '../types';
import { taskDateTime } from './date';

export type ScheduleTaskView = 'upcoming' | 'past' | 'all';

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
