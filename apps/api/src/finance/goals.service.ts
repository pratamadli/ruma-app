import { Injectable, NotFoundException } from '@nestjs/common';
import type { FinanceGoal, FinanceScope } from '@prisma/client';
import type { CreateFinanceGoalInput, UpdateFinanceGoalInput } from '@ruma/validation';
import type { FinanceGoalResponse } from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { accessibleWhere, requireFinanceMember, scopeWhere } from './finance-access';
import { FinanceService } from './finance.service';
import { formatDateOnly, parseDateOnly } from './money';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  async list(familyId: string, actorId: string, scope?: FinanceScope) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const goals = await this.prisma.financeGoal.findMany({
      where: scopeWhere(familyId, actorId, scope),
      orderBy: { createdAt: 'desc' },
    });
    return { goals: goals.map(toGoal) };
  }

  async create(familyId: string, actorId: string, input: CreateFinanceGoalInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.financeGoal.create({
        data: {
          id: createId(),
          familyId,
          scope: input.scope ?? 'HOUSEHOLD',
          ownerUserId: input.scope === 'PERSONAL' ? actorId : null,
          name: input.name,
          targetAmountMinor: BigInt(input.targetAmountMinor),
          currentAmountMinor: BigInt(input.currentAmountMinor ?? '0'),
          targetDate: input.targetDate ? parseDateOnly(input.targetDate) : null,
        },
      });
      await this.finance.audit(tx, familyId, actorId, goal.id, 'GOAL_CREATED');
      return toGoal(goal);
    });
  }

  async update(familyId: string, actorId: string, id: string, input: UpdateFinanceGoalInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.prisma.financeGoal.findFirst({
      where: { id, ...accessibleWhere(familyId, actorId) },
    });
    if (!existing)
      throw new NotFoundException({ code: 'GOAL_NOT_FOUND', message: 'Goal not found.' });
    return this.prisma.$transaction(async (tx) => {
      const goal = await tx.financeGoal.update({
        where: { id },
        data: {
          name: input.name,
          status: input.status,
          targetAmountMinor:
            input.targetAmountMinor === undefined ? undefined : BigInt(input.targetAmountMinor),
          currentAmountMinor:
            input.currentAmountMinor === undefined ? undefined : BigInt(input.currentAmountMinor),
          targetDate:
            input.targetDate === undefined
              ? undefined
              : input.targetDate
                ? parseDateOnly(input.targetDate)
                : null,
        },
      });
      await this.finance.audit(tx, familyId, actorId, id, 'GOAL_UPDATED');
      return toGoal(goal);
    });
  }
}

function toGoal(goal: FinanceGoal): FinanceGoalResponse {
  return {
    id: goal.id,
    scope: goal.scope,
    name: goal.name,
    targetAmountMinor: goal.targetAmountMinor.toString(),
    currentAmountMinor: goal.currentAmountMinor.toString(),
    targetDate: goal.targetDate ? formatDateOnly(goal.targetDate) : null,
    status: goal.status,
  };
}
