import { NotFoundException } from '@nestjs/common';
import type { FinanceScope, Prisma } from '@prisma/client';
import { createId } from '../common/ids';

export async function auditFinance(
  db: Prisma.TransactionClient,
  familyId: string,
  actorId: string,
  resourceId: string,
  action: string,
) {
  await db.financeAudit.create({ data: { id: createId(), familyId, actorId, resourceId, action } });
}

export function scopeWhere(familyId: string, actorId: string, scope: FinanceScope = 'HOUSEHOLD') {
  return { familyId, scope, ...(scope === 'PERSONAL' ? { ownerUserId: actorId } : {}) };
}

export function accessibleWhere(familyId: string, actorId: string) {
  return {
    familyId,
    OR: [{ scope: 'HOUSEHOLD' as const }, { scope: 'PERSONAL' as const, ownerUserId: actorId }],
  };
}

export async function requireFinanceMember(
  db: Prisma.TransactionClient,
  familyId: string,
  actorId: string,
) {
  const member = await db.familyMembership.findFirst({
    where: { familyId, userId: actorId, status: 'ACTIVE', family: { deletedAt: null } },
  });
  if (!member)
    throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
  return member;
}
