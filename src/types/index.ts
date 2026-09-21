export type CalendarMode = 'week' | 'month';

export type ReminderDeliveryMode = 'notification' | 'alarm';

export type AlarmSoundPresetId =
  | 'classic'
  | 'sunrise'
  | 'gentle'
  | 'pulse'
  | 'digital';

export type AlarmBackgroundPresetId =
  | 'dawn'
  | 'aurora'
  | 'forest'
  | 'ocean'
  | 'cosmos'
  | 'gentleDark'
  | 'gentleLight';

export type AlarmBackgroundAppearance = 'dark' | 'light';

export interface AlarmFilePreference {
  name: string;
  uri: string;
}

export interface AlarmSchedulePreferences {
  soundName?: string;
  soundUri?: string;
  vibrate: boolean;
}

export type SortDirection = 'ascending' | 'descending';

export type TaskPriority = 'low' | 'medium' | 'high' | 'none';

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  color?: string;
  notificationId?: string;
  batchId?: string;
  completed: boolean;
  order: number;
  priority?: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerState {
  tasks: Task[];
  hydrated: boolean;
}

export interface ScheduledTaskReminder {
  identifier: string;
  reminderRole?: 'primary' | 'alarmPrealert';
  reminderKey?: string;
  source?: string;
  taskId?: string;
}
