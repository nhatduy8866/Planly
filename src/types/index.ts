export type CalendarMode = 'week' | 'month';

export type ReminderMinutes = number | null;

export type ReminderDeliveryMode = 'notification' | 'alarm';

export type SortDirection = 'ascending' | 'descending';

export type TaskPriority = 'low' | 'medium' | 'high' | 'none';

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  reminderMinutes: ReminderMinutes;
  color?: string;
  notificationId?: string;
  batchId?: string;
  completed: boolean;
  order: number;
  priority?: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerState {
  tasks: Task[];
  notes: Note[];
  hydrated: boolean;
}

export interface ScheduledTaskReminder {
  identifier: string;
  reminderKey?: string;
  source?: string;
  taskId?: string;
}
