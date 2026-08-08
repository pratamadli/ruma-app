import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { CreateInvitationInput } from '@ruma/validation';
import type {
  FamilyInvitationResponse,
  FamilyInvitationsResponse,
  FamilyResponse,
  InvitationPreviewResponse,
} from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { ActivityService } from './activity.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { loadApiEnv } from '../config/env';
import { normalizeEmail } from '@ruma/validation';

@Injectable()
export class InvitationsService {
  private readonly env = loadApiEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    familyId: string,
    inviterId: string,
    input: CreateInvitationInput,
  ): Promise<FamilyInvitationResponse & { inviteUrl: string }> {
    const membership = await this.prisma.familyMembership.findFirst({
      where: { familyId, userId: inviterId, status: 'ACTIVE', family: { deletedAt: null } },
      include: { family: true, user: true },
    });

    if (!membership) {
      throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    }

    // Invite roles are constrained by createInvitationSchema to ADMIN|MEMBER.
    const email = normalizeEmail(input.email);
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.prisma.familyMembership.findFirst({
        where: { familyId, userId: existingUser.id, status: 'ACTIVE' },
      });
      if (existingMembership) {
        throw new ConflictException({
          code: 'ALREADY_MEMBER',
          message: 'That person is already a member of this family.',
        });
      }
    }

    const pending = await this.prisma.familyInvitation.findFirst({
      where: { familyId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    if (pending) {
      throw new ConflictException({
        code: 'INVITE_PENDING',
        message: 'A pending invitation already exists for this email.',
      });
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.env.INVITATION_TTL_SECONDS * 1000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyInvitation.create({
        data: {
          id: createId(),
          familyId,
          inviterId,
          email,
          role: input.role,
          status: 'PENDING',
          tokenHash,
          expiresAt,
        },
      });

      await this.activity.record(
        familyId,
        'MEMBER_INVITED',
        inviterId,
        {
          inviteeEmail: email,
          role: input.role,
          actorName: membership.user.name ?? membership.user.email,
        },
        tx,
      );

      return created;
    });

    const inviteUrl = `${this.env.APP_URL}/invite/${rawToken}`;
    await this.email.sendFamilyInvitation({
      to: email,
      familyName: membership.family.name,
      inviterName: membership.user.name ?? membership.user.email,
      acceptUrl: inviteUrl,
    });

    return { ...this.toInvitationResponse(invitation), inviteUrl };
  }

  async list(familyId: string, userId: string): Promise<FamilyInvitationsResponse> {
    await this.requireMember(familyId, userId);
    await this.expireStale(familyId);

    const invitations = await this.prisma.familyInvitation.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invitations: invitations.map((invitation) => this.toInvitationResponse(invitation)),
    };
  }

  async revoke(familyId: string, userId: string, invitationId: string): Promise<{ ok: true }> {
    const actor = await this.requireMember(familyId, userId);
    if (actor.role === 'MEMBER') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only owners and admins can revoke invitations.',
      });
    }

    const invitation = await this.prisma.familyInvitation.findFirst({
      where: { id: invitationId, familyId },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found.',
      });
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException({
        code: 'INVITATION_NOT_PENDING',
        message: 'Only pending invitations can be revoked.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'REVOKED' },
      });
      await this.activity.record(
        familyId,
        'INVITATION_REVOKED',
        userId,
        { inviteeEmail: invitation.email },
        tx,
      );
    });

    return { ok: true };
  }

  async preview(rawToken: string): Promise<InvitationPreviewResponse> {
    const invitation = await this.findByRawToken(rawToken);
    await this.ensureAcceptable(invitation);

    return {
      familyName: invitation.family.name,
      householdName: invitation.family.householdName,
      inviterName: invitation.inviter.name,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(rawToken: string, userId: string): Promise<FamilyResponse> {
    const invitation = await this.findByRawToken(rawToken);
    await this.ensureAcceptable(invitation);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (normalizeEmail(user.email) !== invitation.email) {
      throw new ForbiddenException({
        code: 'INVITE_EMAIL_MISMATCH',
        message: 'This invitation was sent to a different email address.',
      });
    }

    const existing = await this.prisma.familyMembership.findFirst({
      where: { familyId: invitation.familyId, userId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this family.',
      });
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      // Re-check token status inside transaction for replay safety.
      const fresh = await tx.familyInvitation.findUnique({ where: { id: invitation.id } });
      if (!fresh || fresh.status !== 'PENDING') {
        throw new BadRequestException({
          code: 'INVITATION_NOT_PENDING',
          message: 'This invitation is no longer valid.',
        });
      }

      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedByUserId: userId,
        },
      });

      const prior = await tx.familyMembership.findUnique({
        where: {
          familyId_userId: { familyId: invitation.familyId, userId },
        },
      });

      const active =
        prior == null
          ? await tx.familyMembership.create({
              data: {
                id: createId(),
                familyId: invitation.familyId,
                userId,
                role: invitation.role,
                status: 'ACTIVE',
              },
            })
          : await tx.familyMembership.update({
              where: { id: prior.id },
              data: { role: invitation.role, status: 'ACTIVE' },
            });

      await this.activity.record(
        invitation.familyId,
        'INVITATION_ACCEPTED',
        userId,
        {
          actorName: user.name ?? user.email,
          role: invitation.role,
        },
        tx,
      );
      await this.activity.record(
        invitation.familyId,
        'MEMBER_JOINED',
        userId,
        {
          actorName: user.name ?? user.email,
          role: invitation.role,
        },
        tx,
      );

      const ownersAndAdmins = await tx.familyMembership.findMany({
        where: {
          familyId: invitation.familyId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
          userId: { not: userId },
        },
        select: { userId: true },
      });
      await this.notifications.notifyMany(
        invitation.familyId,
        ownersAndAdmins.map((m) => m.userId),
        'MEMBER_JOINED',
        'New family member',
        `${user.name ?? user.email} joined`,
        { userId, familyId: invitation.familyId },
        tx,
      );

      return active;
    });

    return {
      id: invitation.family.id,
      name: invitation.family.name,
      householdName: invitation.family.householdName,
      timezone: invitation.family.timezone,
      role: membership.role,
      createdAt: invitation.family.createdAt.toISOString(),
    };
  }

  private async findByRawToken(rawToken: string) {
    const invitation = await this.prisma.familyInvitation.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { family: true, inviter: true },
    });
    if (!invitation || invitation.family.deletedAt) {
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found.',
      });
    }
    return invitation;
  }

  private async ensureAcceptable(invitation: { status: string; expiresAt: Date; id: string }) {
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException({
        code: 'INVITATION_REVOKED',
        message: 'This invitation has been revoked.',
      });
    }
    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException({
        code: 'INVITATION_ACCEPTED',
        message: 'This invitation has already been accepted.',
      });
    }
    if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() <= Date.now()) {
      if (invitation.status === 'PENDING') {
        await this.prisma.familyInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new BadRequestException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation has expired.',
      });
    }
  }

  private async expireStale(familyId: string) {
    await this.prisma.familyInvitation.updateMany({
      where: { familyId, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }

  private async requireMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findFirst({
      where: { familyId, userId, status: 'ACTIVE', family: { deletedAt: null } },
    });
    if (!membership) {
      throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    }
    return membership;
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private toInvitationResponse(invitation: {
    id: string;
    email: string;
    role: FamilyInvitationResponse['role'];
    status: FamilyInvitationResponse['status'];
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
  }): FamilyInvitationResponse {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    };
  }
}
