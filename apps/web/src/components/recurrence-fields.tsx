'use client';

import { Label, Select } from '@ruma/ui';
import type { TaskRecurrence } from '@ruma/types';

const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
];

const RECURRENCE_OPTIONS: { value: TaskRecurrence; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Annually' },
  { value: 'CUSTOM_WEEKDAYS', label: 'Custom weekdays' },
];

export function formatRecurrenceLabel(
  recurrence: TaskRecurrence,
  weekdays: number[] = [],
): string | null {
  if (recurrence === 'NONE') return null;
  if (recurrence === 'CUSTOM_WEEKDAYS') {
    const labels = WEEKDAYS.filter((day) => weekdays.includes(day.value)).map((day) => day.short);
    return labels.length > 0 ? `Every ${labels.join(', ')}` : 'Custom weekdays';
  }
  if (recurrence === 'DAILY') return 'Daily';
  if (recurrence === 'WEEKLY') return 'Weekly';
  if (recurrence === 'MONTHLY') return 'Monthly';
  return 'Annually';
}

type RecurrenceFieldsProps = {
  idPrefix: string;
  recurrence: TaskRecurrence;
  weekdays: number[];
  onRecurrenceChange: (value: TaskRecurrence) => void;
  onWeekdaysChange: (value: number[]) => void;
};

export function RecurrenceFields({
  idPrefix,
  recurrence,
  weekdays,
  onRecurrenceChange,
  onWeekdaysChange,
}: RecurrenceFieldsProps) {
  function toggleDay(day: number) {
    if (weekdays.includes(day)) {
      onWeekdaysChange(weekdays.filter((value) => value !== day));
      return;
    }
    onWeekdaysChange([...weekdays, day].sort((a, b) => a - b));
  }

  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-recurrence`}>Repeat</Label>
        <Select
          id={`${idPrefix}-recurrence`}
          value={recurrence}
          onChange={(event) => {
            const next = event.target.value as TaskRecurrence;
            onRecurrenceChange(next);
            if (next !== 'CUSTOM_WEEKDAYS') onWeekdaysChange([]);
          }}
        >
          {RECURRENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {recurrence === 'CUSTOM_WEEKDAYS' ? (
        <div>
          <Label>On these days</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => {
              const active = weekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={active}
                  title={day.label}
                  onClick={() => toggleDay(day.value)}
                  className={[
                    'min-h-10 min-w-12 rounded-[var(--ruma-radius-md)] border px-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-[var(--ruma-color-accent)] bg-[var(--ruma-color-accent-soft)] text-[var(--ruma-color-ink)]'
                      : 'border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] text-[var(--ruma-color-ink-muted)]',
                  ].join(' ')}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
