import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationListResponse, NotificationType } from '@ruma/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    input: {
      familyId: string;
      recipientId: string;
      type: NotificationType;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    if (!input.recipientId) return;
    const client = tx ?? this.prisma;
    await client.notification.create({
      data: {
        id: createId(),
        familyId: input.familyId,
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async notifyMany(
    familyId: string,
    recipientIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    metadata: Record<string, unknown> = {},
    tx?: Prisma.TransactionClient,
  ) {
    const unique = [...new Set(recipientIds.filter(Boolean))];
    await Promise.all(
      unique.map((recipientId) =>
        this.notify({ familyId, recipientId, type, title, message, metadata }, tx),
      ),
    );
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationListResponse> {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, readAt: null },
      }),
    ]);

    return {
      unreadCount,
      notifications: notifications.map((n) => ({
        id: n.id,
        familyId: n.familyId,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: (n.metadata ?? {}) as Record<string, unknown>,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found.',
      });
    }
    if (!existing.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
