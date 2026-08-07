'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardDescription, CardTitle, Input, Label } from '@ruma/ui';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/auth-context';
import {
  createInvitation,
  getFamily,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
} from '@/lib/api';

export default function FamilyMembersPage() {
  const params = useParams<{ familyId: string }>();
  const familyId = params.familyId;
  const { user, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
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

  const canManage = familyQuery.data?.role === 'OWNER' || familyQuery.data?.role === 'ADMIN';

  async function onInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPending(true);
    setError(null);
    setInviteUrl(null);
    try {
      const result = await createInvitation(accessToken, familyId, { email, role: 'MEMBER' });
      setInviteUrl(result.inviteUrl);
      setEmail('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invitations', familyId] }),
        queryClient.invalidateQueries({ queryKey: ['activity', familyId] }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invitation');
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell familyId={familyId}>
      <div className="grid gap-6">
        <header>
          <h1 className="m-0 text-3xl font-semibold tracking-tight">Family members</h1>
          <p className="mt-2 text-[var(--ruma-color-ink-muted)]">
            Manage who shares {familyQuery.data?.name ?? 'this workspace'}.
          </p>
        </header>

        <Card>
          <CardTitle>Invite someone</CardTitle>
          <CardDescription>
            We’ll email them a secure link. In local development the invite URL is also shown here.
          </CardDescription>
          <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={onInvite}>
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Send invite'}
              </Button>
            </div>
          </form>
          {error ? (
            <p className="mt-3 mb-0 text-sm text-[var(--ruma-color-danger)]">{error}</p>
          ) : null}
          {inviteUrl ? (
            <p className="mt-3 mb-0 break-all text-sm text-[var(--ruma-color-ink-muted)]">
              Invite link: {inviteUrl}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Members</CardTitle>
          <ul className="mt-4 grid gap-2 p-0">
            {(membersQuery.data?.members ?? []).map((member) => (
              <li
                key={member.membershipId}
                className="flex list-none flex-col gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <strong>{member.name ?? member.email}</strong>
                  {member.userId === user?.id ? (
                    <span className="ml-2 text-sm text-[var(--ruma-color-ink-muted)]">You</span>
                  ) : null}
                  <div className="text-sm text-[var(--ruma-color-ink-muted)]">{member.email}</div>
                  <div className="text-xs uppercase tracking-wide text-[var(--ruma-color-accent)]">
                    {member.role}
                  </div>
                </div>
                {canManage && member.userId !== user?.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!accessToken) return;
                      if (!confirm(`Remove ${member.name ?? member.email}?`)) return;
                      await removeMember(accessToken, familyId, member.membershipId);
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['members', familyId] }),
                        queryClient.invalidateQueries({ queryKey: ['activity', familyId] }),
                      ]);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Pending invitations</CardTitle>
          <CardDescription>Revoke unused invites anytime.</CardDescription>
          <ul className="mt-4 grid gap-2 p-0">
            {(invitationsQuery.data?.invitations ?? [])
              .filter((invite) => invite.status === 'PENDING')
              .map((invite) => (
                <li
                  key={invite.id}
                  className="flex list-none flex-col gap-3 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <strong>{invite.email}</strong>
                    <div className="text-sm text-[var(--ruma-color-ink-muted)]">
                      {invite.role} · expires {new Date(invite.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!accessToken) return;
                        await revokeInvitation(accessToken, familyId, invite.id);
                        await queryClient.invalidateQueries({
                          queryKey: ['invitations', familyId],
                        });
                      }}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
          </ul>
          {(invitationsQuery.data?.invitations.filter((invite) => invite.status === 'PENDING')
            .length ?? 0) === 0 ? (
            <p className="mt-3 mb-0 text-sm text-[var(--ruma-color-ink-muted)]">
              No pending invitations.
            </p>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
