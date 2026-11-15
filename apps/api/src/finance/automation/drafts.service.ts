import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type TransactionSource } from '@prisma/client';
import {
  createTransactionSchema,
  telegramConnectSchema,
  type DraftInput,
  type TelegramConnectInput,
} from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { createId } from '../../common/ids';
import { FinanceService } from '../finance.service';
import { requireFinanceMember } from '../finance-access';
import { loadApiEnv } from '../../config/env';

@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  async list(familyId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    return {
      drafts: await this.prisma.financeDraft.findMany({
        where: { familyId, ownerUserId: actorId, status: 'PENDING_CONFIRMATION' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    };
  }

  async create(
    familyId: string,
    actorId: string,
    input: DraftInput,
    source: TransactionSource = 'TELEGRAM',
    receiptId?: string,
  ) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const transaction = createTransactionSchema.parse(input.transaction);
    await this.finance.validateLedgerInput(this.prisma, familyId, actorId, transaction);
    const requestHash = createHash('sha256').update(JSON.stringify(transaction)).digest('hex');
    const where = {
      familyId_ownerUserId_idempotencyKey: {
        familyId,
        ownerUserId: actorId,
        idempotencyKey: input.idempotencyKey,
      },
    };
    const existing = await this.prisma.financeDraft.findUnique({ where });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Draft key has already been used.',
        });
      return existing;
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (receiptId) {
          const receipt = await tx.financeReceipt.findFirst({
            where: {
              id: receiptId,
              familyId,
              ownerUserId: actorId,
              scope: transaction.scope ?? 'HOUSEHOLD',
              transactionId: null,
            },
          });
          if (!receipt)
            throw new ConflictException({
              code: 'INVALID_RECEIPT',
              message: 'Receipt is unavailable for this draft.',
            });
        }
        const draft = await tx.financeDraft.create({
          data: {
            id: createId(),
            familyId,
            ownerUserId: actorId,
            scope: transaction.scope ?? 'HOUSEHOLD',
            payload: transaction,
            source,
            receiptId,
            requestHash,
            idempotencyKey: input.idempotencyKey,
            expiresAt: new Date(Date.now() + 15 * 60_000),
          },
        });
        await this.finance.audit(tx, familyId, actorId, draft.id, 'DRAFT_CREATED');
        return draft;
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      const draft = await this.prisma.financeDraft.findUniqueOrThrow({ where });
      if (draft.requestHash !== requestHash)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Draft key has already been used.',
        });
      return draft;
    }
  }

  async get(familyId: string, actorId: string, id: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const draft = await this.prisma.financeDraft.findFirst({
      where: { id, familyId, ownerUserId: actorId },
    });
    if (!draft)
      throw new NotFoundException({ code: 'DRAFT_NOT_FOUND', message: 'Draft not found.' });
    return draft;
  }

  async confirm(familyId: string, actorId: string, id: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    return this.prisma.$transaction(async (tx) => {
      // Row locking makes confirmation single-use even across processes.
      await tx.$queryRaw`SELECT id FROM finance_drafts WHERE id = ${id} AND family_id = ${familyId} AND owner_user_id = ${actorId} FOR UPDATE`;
      const draft = await tx.financeDraft.findFirst({
        where: { id, familyId, ownerUserId: actorId },
      });
      if (!draft)
        throw new NotFoundException({ code: 'DRAFT_NOT_FOUND', message: 'Draft not found.' });
      if (draft.status === 'CONFIRMED')
        return { transactionId: draft.transactionId, status: draft.status };
      if (draft.status !== 'PENDING_CONFIRMATION' || draft.expiresAt <= new Date()) {
        throw new ConflictException({
          code: 'DRAFT_EXPIRED',
          message: 'Draft is expired or cancelled. Create a new draft.',
        });
      }

      await requireFinanceMember(tx, familyId, actorId);
      const parsed = createTransactionSchema.safeParse(draft.payload);
      if (!parsed.success)
        throw new BadRequestException({
          code: 'INVALID_DRAFT',
          message: 'Correct the draft before confirming.',
        });
      const transaction = await this.finance.createLedgerTransaction(
        familyId,
        actorId,
        parsed.data,
        { source: draft.source, sourceReference: `draft:${id}` },
        tx,
      );
      await tx.financeDraft.update({
        where: { id },
        data: { status: 'CONFIRMED', transactionId: transaction.id },
      });
      if (draft.receiptId) {
        const receipt = await tx.financeReceipt.updateMany({
          where: { id: draft.receiptId, ownerUserId: actorId, transactionId: null },
          data: { transactionId: transaction.id },
        });
        if (!receipt.count)
          throw new ConflictException({
            code: 'RECEIPT_CONFIRMED',
            message: 'This receipt already belongs to a transaction.',
          });
      }
      await this.finance.audit(tx, familyId, actorId, id, 'DRAFT_CONFIRMED');
      return { transactionId: transaction.id, status: 'CONFIRMED' };
    });
  }

  async replace(familyId: string, actorId: string, id: string, input: DraftInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.financeDraft.findFirst({
        where: { id, familyId, ownerUserId: actorId },
      });
      if (!old)
        throw new NotFoundException({ code: 'DRAFT_NOT_FOUND', message: 'Draft not found.' });
      if (old.receiptId && (input.transaction.scope ?? 'HOUSEHOLD') !== old.scope)
        throw new BadRequestException({
          code: 'SCOPE_MISMATCH',
          message: 'Receipt scope cannot be changed.',
        });
      const transaction = createTransactionSchema.parse(input.transaction);
      await this.finance.validateLedgerInput(tx, familyId, actorId, transaction);
      const changed = await tx.financeDraft.updateMany({
        where: { id, status: 'PENDING_CONFIRMATION' },
        data: { status: 'CANCELLED' },
      });
      if (!changed.count)
        throw new ConflictException({
          code: 'DRAFT_NOT_PENDING',
          message: 'Only pending drafts can be corrected.',
        });
      const draft = await tx.financeDraft.create({
        data: {
          id: createId(),
          familyId,
          ownerUserId: actorId,
          scope: transaction.scope ?? 'HOUSEHOLD',
          payload: transaction,
          source: old.source,
          receiptId: old.receiptId,
          requestHash: createHash('sha256').update(JSON.stringify(transaction)).digest('hex'),
          idempotencyKey: input.idempotencyKey,
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
      await this.finance.audit(tx, familyId, actorId, draft.id, 'DRAFT_CORRECTED');
      return draft;
    });
  }

  async cancel(familyId: string, actorId: string, id: string) {
    const draft = await this.get(familyId, actorId, id);
    if (draft.status === 'CANCELLED') return { ok: true };
    const result = await this.prisma.financeDraft.updateMany({
      where: { id, ownerUserId: actorId, status: 'PENDING_CONFIRMATION' },
      data: { status: 'CANCELLED' },
    });
    if (!result.count)
      throw new ConflictException({
        code: 'DRAFT_NOT_PENDING',
        message: 'Only pending drafts can be cancelled.',
      });
    return { ok: true };
  }

  async linkStatus(familyId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const link = await this.prisma.telegramLink.findUnique({ where: { userId: actorId } });
    const active = link?.familyId
      ? await this.prisma.familyMembership.findFirst({
          where: {
            familyId: link.familyId,
            userId: actorId,
            status: 'ACTIVE',
            family: { deletedAt: null },
          },
          select: { id: true },
        })
      : null;
    return {
      linked: Boolean(link?.telegramId && active && link.familyId === familyId),
      connectedElsewhere: Boolean(link?.telegramId && active && link.familyId !== familyId),
      requiresReconnect: Boolean(link?.telegramId && !active),
    };
  }

  async createLinkCode(familyId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const code = randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
    const codeExpiresAt = new Date(Date.now() + 10 * 60_000);
    const data = {
      codeHash: createHash('sha256').update(code).digest('hex'),
      codeExpiresAt,
      codeFamilyId: familyId,
    };
    const result = await this.prisma.$transaction(async (tx) => {
      await requireFinanceMember(tx, familyId, actorId);
      await tx.telegramLink.upsert({
        where: { userId: actorId },
        create: { userId: actorId, ...data },
        update: data,
      });
      await this.finance.audit(tx, familyId, actorId, actorId, 'TELEGRAM_CODE_CREATED');
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actorId },
        select: { email: true },
      });
      const household = await tx.family.findUniqueOrThrow({
        where: { id: familyId },
        select: { id: true, name: true },
      });
      return { email: user.email, household };
    });
    const username = loadApiEnv().TELEGRAM_BOT_USERNAME;
    return {
      ...result,
      code,
      expiresAt: codeExpiresAt.toISOString(),
      botUrl: username ? `https://t.me/${username}` : null,
    };
  }

  async consumeLink(input: TelegramConnectInput, telegramId: string) {
    const parsed = telegramConnectSchema.safeParse(input);
    const invalid = () =>
      new BadRequestException({
        code: 'LINK_INVALID',
        message:
          'Email or code is invalid, expired, or no longer authorized. Generate a new code from your household dashboard.',
      });
    if (!parsed.success) throw invalid();
    const codeHash = createHash('sha256').update(parsed.data.code).digest('hex');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT user_id FROM telegram_links WHERE code_hash = ${codeHash} FOR UPDATE`;
        const link = await tx.telegramLink.findFirst({
          where: { codeHash, codeExpiresAt: { gt: new Date() } },
          include: { user: { select: { email: true } } },
        });
        if (!link?.codeFamilyId || link.user.email !== parsed.data.email) throw invalid();
        const membership = await tx.familyMembership.findFirst({
          where: {
            familyId: link.codeFamilyId,
            userId: link.userId,
            status: 'ACTIVE',
            family: { deletedAt: null },
          },
          include: { family: { select: { id: true, name: true } } },
        });
        if (!membership) throw invalid();
        if (link.telegramId && link.telegramId !== telegramId)
          throw new ConflictException({
            code: 'TELEGRAM_ALREADY_LINKED',
            message: 'Disconnect the existing Telegram account from its household dashboard first.',
          });
        await tx.telegramLink.update({
          where: { userId: link.userId },
          data: {
            telegramId,
            familyId: link.codeFamilyId,
            linkedAt: new Date(),
            codeHash: null,
            codeExpiresAt: null,
            codeFamilyId: null,
          },
        });
        await this.finance.audit(
          tx,
          membership.familyId,
          link.userId,
          link.userId,
          'TELEGRAM_CONNECTED',
        );
        return { linked: true, household: membership.family };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException({
          code: 'TELEGRAM_ALREADY_LINKED',
          message: 'This Telegram account is already linked.',
        });
      throw error;
    }
  }

  async connection(telegramId: string) {
    const link = await this.prisma.telegramLink.findUnique({ where: { telegramId } });
    if (!link?.familyId)
      throw new NotFoundException({
        code: 'TELEGRAM_NOT_LINKED',
        message:
          'Connect Telegram using your email and a code from your household dashboard first.',
      });
    await requireFinanceMember(this.prisma, link.familyId, link.userId);
    const household = await this.prisma.family.findUniqueOrThrow({
      where: { id: link.familyId },
      select: { id: true, name: true, timezone: true },
    });
    return { userId: link.userId, household };
  }

  async unlink(familyId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT user_id FROM telegram_links WHERE user_id = ${actorId} FOR UPDATE`;
      const link = await tx.telegramLink.findUnique({ where: { userId: actorId } });
      const active = link?.familyId
        ? await tx.familyMembership.findFirst({
            where: {
              familyId: link.familyId,
              userId: actorId,
              status: 'ACTIVE',
              family: { deletedAt: null },
            },
            select: { id: true },
          })
        : null;
      if (link && (link.familyId === familyId || (link.telegramId && !active))) {
        await tx.telegramLink.update({
          where: { userId: actorId },
          data: {
            telegramId: null,
            familyId: null,
            linkedAt: null,
            codeHash: null,
            codeExpiresAt: null,
            codeFamilyId: null,
          },
        });
        await this.finance.audit(tx, familyId, actorId, actorId, 'TELEGRAM_DISCONNECTED');
      } else
        await tx.telegramLink.updateMany({
          where: { userId: actorId, codeFamilyId: familyId },
          data: { codeHash: null, codeExpiresAt: null, codeFamilyId: null },
        });
    });
    return { ok: true };
  }
}
