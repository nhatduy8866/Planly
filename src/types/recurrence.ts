export type TaskRecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface MonthlyWeekdayRule {
  /** JavaScript weekday: Sunday = 0, Monday = 1, ... Saturday = 6. */
  weekday: number;
  /** 1..5 from the start of the month, -1..-5 from the end. */
  ordinal: number;
}

/**
 * Provider-neutral recurrence rule. Natural-language and manual inputs are
 * both converted to this shape before occurrence dates are generated.
 */
export interface TaskRecurrenceRule {
  frequency: TaskRecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string;
  count?: number;
  weekdays?: number[];
  monthDays?: number[];
  monthlyWeekday?: MonthlyWeekdayRule;
  excludedDates?: string[];
}
