import type { FamilyActivityResponse } from '@ruma/types';

export function formatActivity(activity: FamilyActivityResponse): string {
  const actor = activity.actor?.name ?? activity.actor?.email ?? 'Someone';
  const meta = activity.metadata;

  switch (activity.type) {
    case 'FAMILY_CREATED':
      return `${actor} created the family`;
    case 'MEMBER_INVITED':
      return `${actor} invited ${String(meta.inviteeEmail ?? 'a guest')}`;
    case 'INVITATION_ACCEPTED':
      return `${actor} accepted an invitation`;
    case 'MEMBER_JOINED':
      return `${actor} joined the family`;
    case 'MEMBER_REMOVED':
      return `${actor} removed ${String(meta.removedName ?? meta.removedEmail ?? 'a member')}`;
    case 'INVITATION_REVOKED':
      return `${actor} revoked an invitation to ${String(meta.inviteeEmail ?? 'a guest')}`;
    case 'FAMILY_UPDATED':
      return `${actor} updated family settings`;
    case 'TASK_CREATED':
      return `${actor} created “${String(meta.title ?? 'a task')}”`;
    case 'TASK_ASSIGNED':
      return `${actor} assigned “${String(meta.title ?? 'a task')}”`;
    case 'TASK_COMPLETED':
      return `${actor} completed “${String(meta.title ?? 'a task')}”`;
    case 'GROCERY_ITEM_ADDED':
      return `${actor} added ${String(meta.name ?? 'an item')} to groceries`;
    case 'GROCERY_ITEM_COMPLETED':
      return `${actor} checked off ${String(meta.name ?? 'an item')}`;
    case 'FAMILY_EVENT_CREATED':
      return `${actor} added “${String(meta.title ?? 'an event')}” to the calendar`;
    case 'FAMILY_EVENT_UPDATED':
      return `${actor} updated “${String(meta.title ?? 'an event')}”`;
    case 'FAMILY_EVENT_CANCELLED':
      return `${actor} cancelled “${String(meta.title ?? 'an event')}”`;
    default:
      return `${actor} updated the household`;
  }
}
