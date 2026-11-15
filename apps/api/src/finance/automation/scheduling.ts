import { BadRequestException } from '@nestjs/common';
import type { FinanceSchedule } from '@prisma/client';

export function resolveRecipients(
  scope: string,
  ownerUserId: string | null,
  requested: string[],
  active: string[],
) {
  if (scope === 'PERSONAL') {
    if (
      !ownerUserId ||
      !active.includes(ownerUserId) ||
      requested.some((id) => id !== ownerUserId)
    ) {
      throw new BadRequestException({
        code: 'INVALID_RECIPIENT',
        message: 'Personal reminders can only notify their owner.',
      });
    }
    return [ownerUserId];
  }
  if (requested.some((id) => !active.includes(id)))
    throw new BadRequestException({
      code: 'INVALID_RECIPIENT',
      message: 'Recipients must be active household members.',
    });
  return [...new Set(requested.length ? requested : active)];
}

export function schedulePeriod(
  schedule: Pick<
    FinanceSchedule,
    'kind' | 'dueAt' | 'timezone' | 'deliveryDay' | 'deliveryHour' | 'deliveryMinute'
  >,
  now: Date,
) {
  if (schedule.kind === 'REMINDER')
    return schedule.dueAt && schedule.dueAt <= now ? schedule.dueAt.toISOString() : null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: schedule.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = Number(part('day')),
    minutes = Number(part('hour')) * 60 + Number(part('minute'));
  if (
    day < schedule.deliveryDay ||
    (day === schedule.deliveryDay && minutes < schedule.deliveryHour * 60 + schedule.deliveryMinute)
  )
    return null;
  return `${part('year')}-${part('month')}`;
}
