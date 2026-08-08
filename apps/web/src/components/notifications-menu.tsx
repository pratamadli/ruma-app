'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@ruma/ui';
import { useAuth } from '@/lib/auth-context';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api';

export function NotificationsMenu() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['notifications', accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => listNotifications(accessToken!),
    refetchInterval: open ? 15_000 : 60_000,
  });

  const unread = query.data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--ruma-color-accent)] px-1.5 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-[var(--ruma-radius-lg)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] p-3 shadow-[var(--ruma-shadow-md)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <strong className="text-sm">Notifications</strong>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unread === 0}
              onClick={async () => {
                if (!accessToken) return;
                await markAllNotificationsRead(accessToken);
                await queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }}
            >
              Mark all read
            </Button>
          </div>
          {query.isLoading ? (
            <p className="text-sm text-[var(--ruma-color-ink-muted)]">Loading…</p>
          ) : (query.data?.notifications.length ?? 0) === 0 ? (
            <p className="text-sm text-[var(--ruma-color-ink-muted)]">You&apos;re all caught up.</p>
          ) : (
            <ul className="grid max-h-80 gap-2 overflow-y-auto p-0">
              {query.data?.notifications.map((item) => (
                <li key={item.id} className="list-none">
                  <button
                    type="button"
                    className="w-full rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] px-3 py-2 text-left transition-colors hover:bg-black/5"
                    onClick={async () => {
                      if (!accessToken || item.readAt) return;
                      await markNotificationRead(accessToken, item.id);
                      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-[var(--ruma-color-accent)]'}`}
                      />
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-sm text-[var(--ruma-color-ink-muted)]">
                          {item.message}
                        </div>
                        <div className="mt-1 text-xs text-[var(--ruma-color-ink-muted)]">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
