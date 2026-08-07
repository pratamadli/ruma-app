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
    default:
      return `${actor} updated the family`;
  }
}
