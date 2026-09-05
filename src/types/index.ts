export type CalendarMode = 'week' | 'month';

export type ReminderMinutes = null | 0 | 5 | 10 | 15 | 30 | 60;

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  reminderMinutes: ReminderMinutes;
  notificationId?: string;
  completed: boolean;
  order: number;
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

export type RootTab = 'schedule' | 'tasks' | 'notes';
