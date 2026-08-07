import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateFamilyInput, UpdateFamilyInput } from '@ruma/validation';
import type {
  FamilyListResponse,
  FamilyMemberResponse,
  FamilyMembersResponse,
  FamilyResponse,
} from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { ActivityService } from './activity.service';

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(userId: string, input: CreateFamilyInput): Promise<FamilyResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const familyId = createId();

    const family = await this.prisma.$transaction(async (tx) => {
      const created = await tx.family.create({
        data: {
          id: familyId,
          name: input.name,
          householdName: input.householdName ?? null,
          timezone: input.timezone ?? 'UTC',
        },
      });

      await tx.familyMembership.create({
        data: {
          id: createId(),
          familyId: created.id,
          userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      await this.activity.record(
        created.id,
        'FAMILY_CREATED',
        userId,
        {
          familyName: created.name,
          actorName: user.name ?? user.email,
        },
        tx,
      );

      return created;
    });

    return this.toFamilyResponse(family, 'OWNER');
  }

  async listForUser(userId: string): Promise<FamilyListResponse> {
    const memberships = await this.prisma.familyMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        family: { deletedAt: null },
      },
      include: { family: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      families: memberships.map((membership) =>
        this.toFamilyResponse(membership.family, membership.role),
      ),
    };
  }

  async getForMember(familyId: string, userId: string): Promise<FamilyResponse> {
    const membership = await this.requireActiveMembership(familyId, userId);
    return this.toFamilyResponse(membership.family, membership.role);
  }

  async update(
    familyId: string,
    userId: string,
    input: UpdateFamilyInput,
  ): Promise<FamilyResponse> {
    const membership = await this.requireActiveMembership(familyId, userId);
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only owners and admins can update family settings.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const family = await tx.family.update({
        where: { id: familyId },
        data: {
          name: input.name,
          householdName: input.householdName === undefined ? undefined : input.householdName,
          timezone: input.timezone,
        },
      });

      await this.activity.record(
        familyId,
        'FAMILY_UPDATED',
        userId,
        {
          fields: Object.keys(input),
        },
        tx,
      );

      return family;
    });

    return this.toFamilyResponse(updated, membership.role);
  }

  async listMembers(familyId: string, userId: string): Promise<FamilyMembersResponse> {
    await this.requireActiveMembership(familyId, userId);

    const memberships = await this.prisma.familyMembership.findMany({
      where: { familyId, status: 'ACTIVE' },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      members: memberships.map((membership) => this.toMemberResponse(membership)),
    };
  }

  async removeMember(
    familyId: string,
    actorUserId: string,
    membershipId: string,
  ): Promise<{ ok: true }> {
    const actor = await this.requireActiveMembership(familyId, actorUserId);
    if (actor.role !== 'OWNER' && actor.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only owners and admins can remove members.',
      });
    }

    const target = await this.prisma.familyMembership.findFirst({
      where: { id: membershipId, familyId, status: 'ACTIVE' },
      include: { user: true },
    });

    if (!target) {
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found.',
      });
    }

    if (target.role === 'OWNER') {
      const ownerCount = await this.prisma.familyMembership.count({
        where: { familyId, status: 'ACTIVE', role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_OWNER',
          message: 'Cannot remove the last owner of a family.',
        });
      }
    }

    if (actor.role === 'ADMIN' && target.role === 'OWNER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admins cannot remove owners.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyMembership.update({
        where: { id: target.id },
        data: { status: 'REMOVED' },
      });

      await this.activity.record(
        familyId,
        'MEMBER_REMOVED',
        actorUserId,
        {
          removedUserId: target.userId,
          removedEmail: target.user.email,
          removedName: target.user.name,
        },
        tx,
      );
    });

    return { ok: true };
  }

  private async requireActiveMembership(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findFirst({
      where: {
        familyId,
        userId,
        status: 'ACTIVE',
        family: { deletedAt: null },
      },
      include: { family: true },
    });

    if (!membership) {
      throw new NotFoundException({
        code: 'FAMILY_NOT_FOUND',
        message: 'Family not found.',
      });
    }

    return membership;
  }

  private toFamilyResponse(
    family: {
      id: string;
      name: string;
      householdName: string | null;
      timezone: string;
      createdAt: Date;
    },
    role: FamilyResponse['role'],
  ): FamilyResponse {
    return {
      id: family.id,
      name: family.name,
      householdName: family.householdName,
      timezone: family.timezone,
      role,
      createdAt: family.createdAt.toISOString(),
    };
  }

  private toMemberResponse(membership: {
    id: string;
    userId: string;
    role: FamilyMemberResponse['role'];
    createdAt: Date;
    user: { email: string; name: string | null };
  }): FamilyMemberResponse {
    return {
      membershipId: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
    };
  }
}
