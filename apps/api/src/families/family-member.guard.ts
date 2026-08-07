import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser, FamilyMembershipContext } from '../auth/auth.types';

@Injectable()
export class FamilyMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { familyId?: string };
      user?: AuthenticatedUser;
      familyMembership?: FamilyMembershipContext;
    }>();

    const familyId = request.params.familyId;
    const user = request.user;

    if (!familyId || !user) {
      throw new NotFoundException({
        code: 'FAMILY_NOT_FOUND',
        message: 'Family not found.',
      });
    }

    const membership = await this.prisma.familyMembership.findFirst({
      where: {
        familyId,
        userId: user.id,
        status: 'ACTIVE',
        family: { deletedAt: null },
      },
    });

    if (!membership) {
      // Prefer 404 to avoid leaking family existence across tenants.
      throw new NotFoundException({
        code: 'FAMILY_NOT_FOUND',
        message: 'Family not found.',
      });
    }

    request.familyMembership = {
      id: membership.id,
      familyId: membership.familyId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };

    return true;
  }
}
