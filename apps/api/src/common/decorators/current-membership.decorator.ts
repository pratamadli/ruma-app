import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FamilyMembershipContext } from '../../auth/auth.types';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): FamilyMembershipContext => {
    const request = ctx.switchToHttp().getRequest<{ familyMembership: FamilyMembershipContext }>();
    return request.familyMembership;
  },
);
