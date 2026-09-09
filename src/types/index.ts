export type CalendarMode = 'week' | 'month';

export type ReminderMinutes = number | null;

export type TaskPriority = 'low' | 'medium' | 'high' | 'none';

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  reminderMinutes: ReminderMinutes;
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
