import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma, type FinanceScope } from '@prisma/client';
import {
  financeScheduleSchema,
  type FinanceScheduleInput,
  type UpdateFinanceScheduleInput,
} from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { createId } from '../../common/ids';
import { loadApiEnv } from '../../config/env';
import { accessibleWhere, requireFinanceMember, scopeWhere } from '../finance-access';
import { FinanceService } from '../finance.service';
import { shiftMonth } from '../budget-progress';
import { TelegramClient } from './telegram.client';
import { resolveRecipients, schedulePeriod } from './scheduling';

@Injectable()
export class SchedulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulesService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly telegram: TelegramClient,
  ) {}
  onModuleInit() {
    if (loadApiEnv().FINANCE_JOBS_ENABLED) {
      this.timer = setInterval(() => {
        void this.run().catch(() =>
          this.logger.error(JSON.stringify({ event: 'finance_jobs_failed' })),
        );
      }, 60000);
      this.timer.unref();
    }
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async list(familyId: string, actorId: string, scope?: FinanceScope) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const schedules = await this.prisma.financeSchedule.findMany({
      where: scopeWhere(familyId, actorId, scope),
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            recipientId: true,
            status: true,
            periodKey: true,
            attempts: true,
            errorCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { schedules };
  }
  async create(familyId: string, actorId: string, input: FinanceScheduleInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const ownerUserId = input.scope === 'PERSONAL' ? actorId : null;
    const active = await this.activeMembers(familyId);
    resolveRecipients(input.scope, ownerUserId, input.recipientIds, active);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const schedule = await tx.financeSchedule.create({
          data: {
            id: createId(),
            familyId,
            createdById: actorId,
            ownerUserId,
            ...input,
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
          },
        });
        await this.finance.audit(tx, familyId, actorId, schedule.id, 'SCHEDULE_CREATED');
        return { id: schedule.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException({
          code: 'REPORT_EXISTS',
          message: 'A monthly report already exists in this scope. Edit it instead.',
        });
      throw error;
    }
  }
  async update(familyId: string, actorId: string, id: string, input: UpdateFinanceScheduleInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.prisma.financeSchedule.findFirst({
      where: { id, ...accessibleWhere(familyId, actorId) },
    });
    if (!existing)
      throw new NotFoundException({ code: 'SCHEDULE_NOT_FOUND', message: 'Schedule not found.' });
    const data = financeScheduleSchema.parse({
      ...existing,
      description: existing.description ?? undefined,
      dueAt: existing.dueAt?.toISOString(),
      ...input,
    });
    resolveRecipients(
      existing.scope,
      existing.ownerUserId,
      data.recipientIds,
      await this.activeMembers(familyId),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.financeSchedule.update({
        where: { id },
        data: { ...data, dueAt: data.dueAt ? new Date(data.dueAt) : null, enabled: input.enabled },
      });
      await this.finance.audit(tx, familyId, actorId, id, 'SCHEDULE_UPDATED');
    });
    return { ok: true };
  }
  async run(now = new Date()) {
    if (this.running) return { busy: true };
    this.running = true;
    try {
      await this.prisma.financeDelivery.updateMany({
        where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
        data: { status: 'UNCERTAIN', errorCode: 'WORKER_INTERRUPTED' },
      });
      const schedules = await this.prisma.financeSchedule.findMany({
        where: { enabled: true },
        orderBy: { id: 'asc' },
      });
      for (const schedule of schedules) {
        const periodKey = schedulePeriod(schedule, now);
        if (!periodKey) continue;
        const active = await this.activeMembers(schedule.familyId);
        if (!active.includes(schedule.createdById)) {
          this.logger.warn(
            JSON.stringify({ event: 'finance_schedule_owner_removed', scheduleId: schedule.id }),
          );
          continue;
        }
        const recipients =
          schedule.scope === 'PERSONAL'
            ? active.filter((id) => id === schedule.ownerUserId)
            : schedule.recipientIds.length
              ? active.filter((id) => schedule.recipientIds.includes(id))
              : active;
        for (const recipientId of recipients) {
          const delivery = await this.prisma.financeDelivery.upsert({
            where: {
              scheduleId_recipientId_periodKey: { scheduleId: schedule.id, recipientId, periodKey },
            },
            create: { id: createId(), scheduleId: schedule.id, recipientId, periodKey },
            update: {},
          });
          const claim = await this.prisma.financeDelivery.updateMany({
            where: { id: delivery.id, status: 'PENDING' },
            data: { status: 'SENDING', attempts: { increment: 1 } },
          });
          if (!claim.count) continue;
          let sent = false;
          try {
            await requireFinanceMember(this.prisma, schedule.familyId, schedule.createdById);
            await requireFinanceMember(this.prisma, schedule.familyId, recipientId);
            const current = await this.prisma.financeSchedule.findFirst({
              where: { id: schedule.id, enabled: true, updatedAt: schedule.updatedAt },
            });
            if (!current) throw new Error('SCHEDULE_CHANGED');
            const link = await this.prisma.telegramLink.findUnique({
              where: { userId: recipientId },
            });
            if (!link?.telegramId || link.familyId !== schedule.familyId)
              throw new Error('TELEGRAM_NOT_LINKED');
            let text = `${schedule.title}\n${schedule.description ?? ''}`;
            if (schedule.kind === 'MONTHLY_REPORT') {
              const month = shiftMonth(periodKey, -1);
              const summary = await this.finance.getSummary(
                schedule.familyId,
                { month, scope: schedule.scope },
                schedule.ownerUserId ?? schedule.createdById,
              );
              text = `RUMA ${schedule.scope.toLowerCase()} report · ${month}\nIncome IDR ${summary.incomeMinor}\nExpenses IDR ${summary.expenseMinor}\nDividends IDR ${summary.dividendMinor}\nNet cash flow IDR ${summary.netCashFlowMinor}`;
            }
            await this.telegram.send(link.telegramId, text);
            sent = true;
            await this.prisma.financeDelivery.update({
              where: { id: delivery.id },
              data: { status: 'SENT', deliveredAt: new Date(), errorCode: null },
            });
          } catch (error) {
            const response = error instanceof HttpException ? error.getResponse() : null;
            const code =
              response &&
              typeof response === 'object' &&
              'code' in response &&
              typeof response.code === 'string'
                ? response.code
                : error instanceof Error &&
                    ['SCHEDULE_CHANGED', 'TELEGRAM_NOT_LINKED'].includes(error.message)
                  ? error.message
                  : 'DELIVERY_FAILED';
            const uncertain = sent || code === 'TELEGRAM_DELIVERY_UNCERTAIN';
            await this.prisma.financeDelivery.update({
              where: { id: delivery.id },
              data: { status: uncertain ? 'UNCERTAIN' : 'FAILED', errorCode: code },
            });
            this.logger.warn(
              JSON.stringify({ event: 'finance_delivery_failed', deliveryId: delivery.id, code }),
            );
          }
        }
      }
      return { ok: true };
    } finally {
      this.running = false;
    }
  }
  private async activeMembers(familyId: string) {
    return (
      await this.prisma.familyMembership.findMany({
        where: { familyId, status: 'ACTIVE', family: { deletedAt: null } },
        select: { userId: true },
      })
    ).map((member) => member.userId);
  }
}
