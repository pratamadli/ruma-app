import { Injectable } from '@nestjs/common';
import type { FamilyActivityListResponse, FamilyActivityType } from '@ruma/types';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    familyId: string,
    type: FamilyActivityType,
    actorId: string | null,
    metadata: Record<string, unknown> = {},
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await client.familyActivity.create({
      data: {
        id: createId(),
        familyId,
        actorId,
        type,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async listForFamily(familyId: string, limit = 30): Promise<FamilyActivityListResponse> {
    const activities = await this.prisma.familyActivity.findMany({
      where: { familyId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      activities: activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        actor: activity.actor
          ? {
              id: activity.actor.id,
              name: activity.actor.name,
              email: activity.actor.email,
            }
          : null,
        metadata: (activity.metadata ?? {}) as Record<string, unknown>,
        createdAt: activity.createdAt.toISOString(),
      })),
    };
  }
}
