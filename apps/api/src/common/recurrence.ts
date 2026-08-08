import type { TaskRecurrence } from '@ruma/types';

export function normalizeRecurrence(input: {
  recurrence?: TaskRecurrence;
  recurrenceWeekdays?: number[];
}): { recurrence: TaskRecurrence; recurrenceWeekdays: number[] } {
  const recurrence = input.recurrence ?? 'NONE';
  const recurrenceWeekdays =
    recurrence === 'CUSTOM_WEEKDAYS'
      ? [...new Set(input.recurrenceWeekdays ?? [])].sort((a, b) => a - b)
      : [];
  return { recurrence, recurrenceWeekdays };
}
