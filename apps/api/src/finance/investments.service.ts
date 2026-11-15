import { Injectable, NotFoundException } from '@nestjs/common';
import type { FinanceScope } from '@prisma/client';
import type {
  InvestmentPositionInput,
  InvestmentValuationInput,
  UpdatePositionInput,
} from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { accessibleWhere, requireFinanceMember, scopeWhere } from './finance-access';
import { FinanceService } from './finance.service';
import { formatDateOnly, parseDateOnly } from './money';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}
  async list(familyId: string, actorId: string, scope?: FinanceScope) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const rows = await this.prisma.investmentPosition.findMany({
      where: scopeWhere(familyId, actorId, scope),
      include: { valuations: { orderBy: { valuationDate: 'desc' }, take: 1 } },
      orderBy: { instrumentName: 'asc' },
    });
    const positions = rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      accountId: row.accountId,
      instrumentName: row.instrumentName,
      assetType: row.assetType,
      unitsDecimal: row.unitsDecimal,
      isActive: row.isActive,
      valueMinor: row.valuations[0]?.valueMinor.toString() ?? null,
      valuationDate: row.valuations[0] ? formatDateOnly(row.valuations[0].valuationDate) : null,
    }));
    return {
      positions,
      totalValuationMinor: positions
        .filter((p) => p.isActive)
        .reduce((sum, position) => sum + BigInt(position.valueMinor ?? '0'), 0n)
        .toString(),
    };
  }
  async create(familyId: string, actorId: string, input: InvestmentPositionInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const account = await this.prisma.financialAccount.findFirst({
      where: {
        id: input.accountId,
        ...scopeWhere(familyId, actorId, input.scope),
        type: 'INVESTMENT',
        isActive: true,
        deletedAt: null,
      },
    });
    if (!account)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Choose an investment account in this scope.',
      });
    return this.prisma.$transaction(async (tx) => {
      const position = await tx.investmentPosition.create({
        data: {
          id: createId(),
          familyId,
          ...input,
          ownerUserId: input.scope === 'PERSONAL' ? actorId : null,
        },
      });
      await this.finance.audit(tx, familyId, actorId, position.id, 'INVESTMENT_POSITION_CREATED');
      return { id: position.id };
    });
  }
  async update(familyId: string, actorId: string, id: string, input: UpdatePositionInput) {
    await this.requirePosition(familyId, actorId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.investmentPosition.update({ where: { id }, data: input });
      await this.finance.audit(tx, familyId, actorId, id, 'INVESTMENT_POSITION_UPDATED');
    });
    return { ok: true };
  }
  async value(familyId: string, actorId: string, id: string, input: InvestmentValuationInput) {
    await this.requirePosition(familyId, actorId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.investmentValuation.upsert({
        where: {
          positionId_valuationDate: {
            positionId: id,
            valuationDate: parseDateOnly(input.valuationDate),
          },
        },
        create: {
          id: createId(),
          positionId: id,
          valuationDate: parseDateOnly(input.valuationDate),
          valueMinor: BigInt(input.valueMinor),
        },
        update: { valueMinor: BigInt(input.valueMinor) },
      });
      await this.finance.audit(tx, familyId, actorId, id, 'INVESTMENT_VALUED');
    });
    return { ok: true };
  }
  private async requirePosition(familyId: string, actorId: string, id: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const position = await this.prisma.investmentPosition.findFirst({
      where: { id, ...accessibleWhere(familyId, actorId) },
    });
    if (!position)
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: 'Investment position not found.',
      });
    return position;
  }
}
