'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import { getFamily, listInvitations, listMembers, updateFamily } from '@/lib/api';

export default function FamilySettingsPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const familyQuery = useQuery({
    queryKey: ['family', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => getFamily(accessToken!, familyId),
  });

  const membersQuery = useQuery({
    queryKey: ['members', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listMembers(accessToken!, familyId),
  });

  const invitationsQuery = useQuery({
    queryKey: ['invitations', familyId, accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listInvitations(accessToken!, familyId),
  });

  useEffect(() => {
    if (!familyQuery.data) return;
    setName(familyQuery.data.name);
    setHouseholdName(familyQuery.data.householdName ?? '');
    setTimezone(familyQuery.data.timezone);
  }, [familyQuery.data]);

  const canEdit = familyQuery.data?.role === 'OWNER' || familyQuery.data?.role === 'ADMIN';
  const owner = membersQuery.data?.members.find((member) => member.role === 'OWNER');

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !canEdit) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await updateFamily(accessToken, familyId, {
        name,
        householdName: householdName || null,
        timezone,
      });
      setMessage('Family settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      await queryClient.invalidateQueries({ queryKey: ['families'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings');
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header>
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Family settings</h1>
          <p className="mt-2 text-[var(--ruma-color-ink-muted)]">
            Keep the household identity clear for everyone.
          </p>
        </header>

        <Card>
          <CardTitle>Workspace details</CardTitle>
          <CardDescription>Owner: {owner?.name ?? owner?.email ?? '—'}</CardDescription>
          <form className="mt-4 grid gap-4" onSubmit={onSave}>
            <div>
              <Label htmlFor="family-name">Family name</Label>
              <Input
                id="family-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>
            <div>
              <Label htmlFor="household-name">Household name</Label>
              <Input
                id="household-name"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={!canEdit}
                required
              />
            </div>
            {error ? <p className="m-0 text-sm text-[var(--ruma-color-danger)]">{error}</p> : null}
            {message ? (
              <p className="m-0 text-sm text-[var(--ruma-color-accent)]">{message}</p>
            ) : null}
            {canEdit ? (
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            ) : (
              <p className="m-0 text-sm text-[var(--ruma-color-ink-muted)]">
                Only owners and admins can edit these settings.
              </p>
            )}
          </form>
        </Card>

        <Card>
          <CardTitle>Members snapshot</CardTitle>
          <CardDescription>{membersQuery.data?.members.length ?? 0} active members</CardDescription>
          <ul className="mt-4 grid gap-2 p-0">
            {(membersQuery.data?.members ?? []).map((member) => (
              <li key={member.membershipId} className="list-none text-sm">
                {member.name ?? member.email} · {member.role}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Pending invitations</CardTitle>
          <ul className="mt-4 grid gap-2 p-0">
            {(invitationsQuery.data?.invitations ?? [])
              .filter((invite) => invite.status === 'PENDING')
              .map((invite) => (
                <li key={invite.id} className="list-none text-sm">
                  {invite.email} · {invite.role}
                </li>
              ))}
          </ul>
          {(invitationsQuery.data?.invitations.filter((invite) => invite.status === 'PENDING')
            .length ?? 0) === 0 ? (
            <p className="mt-2 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">None pending.</p>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
