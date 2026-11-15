import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { resetApiEnvCache } from '../../config/env';
import { TelegramClient } from './telegram.client';
import { ReceiptStorage } from '../receipts/receipt-storage';
import { ReceiptOcr } from '../receipts/receipt-ocr';
import sharp from 'sharp';
import { SchedulesService } from './schedules.service';
import { createId } from '../../common/ids';

describe.runIf(Boolean(process.env.DATABASE_URL))('assisted finance authorization', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let familyId: string;
  let secondFamilyId: string | undefined;
  let userId: string;
  let token: string;
  let accountId: string;
  let otherUserId: string;
  let otherToken: string;
  const serviceToken = 'test-hermes-service-token-long-enough';
  const webhookSecret = 'test-telegram-webhook-secret-long-enough';
  const telegramId = String(Date.now());
  const send = vi.fn().mockResolvedValue(undefined);
  const files = new Map<string, Buffer>();

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters!';
    process.env.HERMES_SERVICE_TOKEN = serviceToken;
    process.env.TELEGRAM_WEBHOOK_SECRET = webhookSecret;
    resetApiEnvCache();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TelegramClient)
      .useValue({ send })
      .overrideProvider(ReceiptOcr)
      .useValue({
        extract: vi.fn().mockResolvedValue({
          totalMinor: '45000',
          date: '2026-11-01',
          merchant: 'Test merchant',
          confidence: 0.4,
        }),
      })
      .overrideProvider(ReceiptStorage)
      .useValue({
        put: async (key: string, data: Buffer) => {
          files.set(key, data);
        },
        get: async (key: string) => files.get(key),
        remove: async (key: string) => {
          files.delete(key);
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    const signUp = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: `automation-${telegramId}@example.test`, password: 'password123' })
      .expect(201);
    token = signUp.body.accessToken;
    userId = signUp.body.user.id;
    const family = await request(app.getHttpServer())
      .post('/v1/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Automation test' })
      .expect(201);
    familyId = family.body.id;
    const account = await request(app.getHttpServer())
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Private cash', scope: 'PERSONAL' })
      .expect(201);
    accountId = account.body.id;
    const other = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: `recipient-${telegramId}@example.test`, password: 'password123' })
      .expect(201);
    otherUserId = other.body.user.id;
    otherToken = other.body.accessToken;
    await prisma.familyMembership.create({
      data: { id: createId(), familyId, userId: otherUserId, role: 'MEMBER' },
    });
  }, 60000);

  afterAll(async () => {
    for (const id of [familyId, secondFamilyId].filter((id): id is string => Boolean(id))) {
      await prisma.transaction.deleteMany({ where: { familyId: id } });
      await prisma.financialAccount.deleteMany({ where: { familyId: id } });
      await prisma.transactionCategory.deleteMany({ where: { familyId: id } });
      await prisma.familyActivity.deleteMany({ where: { familyId: id } });
      await prisma.familyMembership.deleteMany({ where: { familyId: id } });
      await prisma.family.delete({ where: { id } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (otherUserId) await prisma.user.delete({ where: { id: otherUserId } });
    await app?.close();
    delete process.env.HERMES_SERVICE_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    resetApiEnvCache();
  });

  it('links once and prevents model/service confirmation from writing the ledger', async () => {
    const server = app.getHttpServer();
    const tools = (input: object) =>
      request(server)
        .post('/v1/integrations/hermes/tools')
        .set('Authorization', `Bearer ${serviceToken}`)
        .set('x-telegram-user-id', telegramId)
        .send(input);
    await tools({ tool: 'get_finance_context' }).expect(404);
    const link = await request(server)
      .post(`/v1/families/${familyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const message = {
      update_id: 1,
      message: {
        from: { id: Number(telegramId) },
        chat: { id: Number(telegramId), type: 'private' },
        text: `/ruma connect ${link.body.email} ${link.body.code}`,
      },
    };
    await request(server).post('/v1/integrations/telegram/webhook').send(message).expect(401);
    await request(server)
      .post('/v1/integrations/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', webhookSecret)
      .send(message)
      .expect(200);
    await request(server)
      .post('/v1/integrations/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', webhookSecret)
      .send(message)
      .expect(400);
    const draftInput = {
      tool: 'create_transaction_draft',
      familyId,
      input: {
        idempotencyKey: 'telegram-draft-test',
        transaction: {
          scope: 'PERSONAL',
          type: 'EXPENSE',
          accountId,
          amountMinor: '45000',
          transactionDate: '2026-11-01',
        },
      },
    };
    const draft = await tools(draftInput).expect(201);
    const retry = await tools(draftInput).expect(201);
    expect(retry.body.draft.id).toBe(draft.body.draft.id);
    await tools({ tool: 'confirm_transaction', familyId, draftId: draft.body.draft.id }).expect(
      201,
    );
    expect(await prisma.transaction.count({ where: { familyId } })).toBe(0);
    const callback = {
      update_id: 2,
      callback_query: {
        id: 'callback',
        from: { id: Number(telegramId) },
        message: { chat: { id: Number(telegramId), type: 'private' } },
        data: draft.body.confirmation[0].callback_data,
      },
    };
    await request(server)
      .post('/v1/integrations/telegram/webhook')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send(callback)
      .expect(401);
    await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post('/v1/integrations/telegram/webhook')
          .set('x-telegram-bot-api-secret-token', webhookSecret)
          .send(callback)
          .expect(200),
      ),
    );
    expect(await prisma.transaction.count({ where: { familyId } })).toBe(1);
    const expired = await tools({
      ...draftInput,
      input: { ...draftInput.input, idempotencyKey: 'expired-draft-key' },
    }).expect(201);
    await prisma.financeDraft.update({
      where: { id: expired.body.draft.id },
      data: { expiresAt: new Date(0) },
    });
    await request(server)
      .post(`/v1/families/${familyId}/finance/drafts/${expired.body.draft.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    await request(server)
      .delete(`/v1/families/${familyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await tools({ tool: 'get_finance_context' }).expect(404);
  }, 60000);

  it('keeps receipt extraction pending and invalidates a corrected draft confirmation', async () => {
    const server = app.getHttpServer();
    const count = await prisma.transaction.count({ where: { familyId } });
    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const receipt = await request(server)
      .post(`/v1/families/${familyId}/finance/receipts`)
      .set('Authorization', `Bearer ${token}`)
      .field('scope', 'PERSONAL')
      .attach('file', image, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(201);
    expect(receipt.body.status).toBe('NEEDS_REVIEW');
    expect(await prisma.transaction.count({ where: { familyId } })).toBe(count);
    await request(server)
      .post(`/v1/families/${familyId}/finance/receipts`)
      .set('Authorization', `Bearer ${token}`)
      .field('scope', 'PERSONAL')
      .attach('file', image, { filename: 'again.png', contentType: 'image/png' })
      .expect(409);
    await request(server)
      .get(`/v1/families/${familyId}/finance/receipts/${receipt.body.id}/file`)
      .expect(401);
    await request(server)
      .get(`/v1/families/${familyId}/finance/receipts/${receipt.body.id}/file`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    const transaction = {
      scope: 'PERSONAL',
      type: 'EXPENSE',
      accountId,
      amountMinor: '45000',
      transactionDate: '2026-11-01',
    };
    const draft = await request(server)
      .post(`/v1/families/${familyId}/finance/receipts/${receipt.body.id}/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transaction, idempotencyKey: 'receipt-review-key' })
      .expect(201);
    const corrected = await request(server)
      .patch(`/v1/families/${familyId}/finance/drafts/${draft.body.draft.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        transaction: { ...transaction, amountMinor: '46000' },
        idempotencyKey: 'corrected-receipt-key',
      })
      .expect(200);
    await request(server)
      .post(`/v1/families/${familyId}/finance/drafts/${draft.body.draft.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    const confirmed = await request(server)
      .post(`/v1/families/${familyId}/finance/drafts/${corrected.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const stored = await prisma.financeReceipt.findUniqueOrThrow({
      where: { id: receipt.body.id },
    });
    expect(stored.transactionId).toBe(confirmed.body.transactionId);
    const detail = await request(server)
      .get(`/v1/families/${familyId}/finance/transactions/${confirmed.body.transactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.receiptIds).toEqual([receipt.body.id]);
    await request(server)
      .get(`/v1/families/${familyId}/finance/receipts/${receipt.body.id}/file`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    expect(await prisma.transaction.count({ where: { familyId } })).toBe(count + 1);
  });

  it('delivers personal reminders privately and household monthly reports once without personal amounts', async () => {
    const server = app.getHttpServer();
    await prisma.telegramLink.update({ where: { userId }, data: { telegramId, familyId } });
    await prisma.telegramLink.create({
      data: { userId: otherUserId, telegramId: String(Number(telegramId) + 1), familyId },
    });
    const personal = await request(server)
      .post(`/v1/families/${familyId}/finance/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'PERSONAL',
        kind: 'REMINDER',
        title: 'Private reminder',
        dueAt: '2026-12-01T08:00:00Z',
        timezone: 'UTC',
      })
      .expect(201);
    await request(server)
      .patch(`/v1/families/${familyId}/finance/schedules/${personal.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ enabled: false })
      .expect(404);
    const otherSchedules = await request(server)
      .get(`/v1/families/${familyId}/finance/schedules?scope=PERSONAL`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(otherSchedules.body.schedules).toHaveLength(0);
    await request(server)
      .post(`/v1/families/${familyId}/finance/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'PERSONAL',
        kind: 'REMINDER',
        title: 'Invalid recipients',
        dueAt: '2026-12-01T08:00:00Z',
        timezone: 'UTC',
        recipientIds: [otherUserId],
      })
      .expect(400);
    const report = await request(server)
      .post(`/v1/families/${familyId}/finance/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'HOUSEHOLD',
        kind: 'MONTHLY_REPORT',
        title: 'Household report',
        timezone: 'UTC',
        deliveryDay: 1,
        deliveryHour: 9,
      })
      .expect(201);
    const jobs = app.get(SchedulesService);
    send.mockClear();
    await jobs.run(new Date('2026-12-01T09:00:00Z'));
    expect(send).toHaveBeenCalledTimes(3);
    expect(
      send.mock.calls
        .filter((call) => String(call[1]).includes('Private reminder'))
        .map((call) => call[0]),
    ).toEqual([telegramId]);
    const reports = send.mock.calls.filter((call) => String(call[1]).includes('household report'));
    expect(reports).toHaveLength(2);
    expect(reports.every((call) => String(call[1]).includes('Expenses IDR 0'))).toBe(true);
    await jobs.run(new Date('2026-12-01T10:00:00Z'));
    expect(send).toHaveBeenCalledTimes(3);
    const personalDeliveries = await prisma.financeDelivery.findMany({
      where: { scheduleId: personal.body.id },
    });
    expect(personalDeliveries.map((delivery) => delivery.recipientId)).toEqual([userId]);
    expect(personalDeliveries[0]?.attempts).toBe(1);
    send.mockRejectedValueOnce(
      new ServiceUnavailableException({ code: 'TELEGRAM_DELIVERY_UNCERTAIN', message: 'Timeout' }),
    );
    await jobs.run(new Date('2027-01-01T09:00:00Z'));
    const uncertain = await prisma.financeDelivery.count({
      where: { scheduleId: report.body.id, periodKey: '2027-01', status: 'UNCERTAIN' },
    });
    expect(uncertain).toBe(1);
    const calls = send.mock.calls.length;
    await jobs.run(new Date('2027-01-01T10:00:00Z'));
    expect(send).toHaveBeenCalledTimes(calls);
  });

  it('verifies the code owner email and membership, rejecting replay, expiry and identity replacement', async () => {
    const server = app.getHttpServer();
    const code = (actorToken = token) =>
      request(server)
        .post(`/v1/families/${familyId}/finance/telegram/link`)
        .set('Authorization', `Bearer ${actorToken}`)
        .expect(201);
    const connect = (email: string, value: string, sender = telegramId) =>
      request(server)
        .post('/v1/integrations/hermes/telegram/connect')
        .set('Authorization', `Bearer ${serviceToken}`)
        .set('x-telegram-user-id', sender)
        .send({ email, code: value });
    await prisma.telegramLink.update({ where: { userId }, data: { familyId: null } });
    const legacy = await request(server)
      .get(`/v1/families/${familyId}/finance/telegram`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(legacy.body.requiresReconnect).toBe(true);
    await request(server)
      .delete(`/v1/families/${familyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      (await prisma.telegramLink.findUniqueOrThrow({ where: { userId } })).telegramId,
    ).toBeNull();
    await request(server)
      .delete(`/v1/families/${familyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    const issued = await code();
    expect(issued.body.household.id).toBe(familyId);
    expect(issued.body.email).toBe(`automation-${telegramId}@example.test`);
    await request(server)
      .post('/v1/integrations/hermes/telegram/connect')
      .set('x-telegram-user-id', telegramId)
      .send({ email: issued.body.email, code: issued.body.code })
      .expect(401);
    await connect(`recipient-${telegramId}@example.test`, issued.body.code).expect(400);
    await request(server)
      .post('/v1/integrations/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', webhookSecret)
      .send({
        update_id: 50,
        message: {
          from: { id: Number(telegramId) },
          chat: { id: -100, type: 'group' },
          text: `/ruma connect ${issued.body.email} ${issued.body.code}`,
        },
      })
      .expect(400);
    const attempts = await Promise.all([
      connect(issued.body.email.toUpperCase(), issued.body.code),
      connect(issued.body.email, issued.body.code),
    ]);
    expect(attempts.map((result) => result.status).sort()).toEqual([201, 400]);
    const stored = await prisma.telegramLink.findUniqueOrThrow({ where: { userId } });
    expect(stored.familyId).toBe(familyId);
    expect(stored.codeHash).toBeNull();
    expect(stored.codeFamilyId).toBeNull();
    const otherCode = await code(otherToken);
    await connect(otherCode.body.email, otherCode.body.code).expect(409);
    const replace = await code();
    await connect(replace.body.email, replace.body.code, String(Number(telegramId) + 99)).expect(
      409,
    );
    const expired = await code();
    await prisma.telegramLink.update({ where: { userId }, data: { codeExpiresAt: new Date(0) } });
    await connect(expired.body.email, expired.body.code).expect(400);
    const superseded = await code();
    const current = await code();
    await connect(superseded.body.email, superseded.body.code).expect(400);
    await prisma.familyMembership.update({
      where: { familyId_userId: { familyId, userId } },
      data: { status: 'REMOVED' },
    });
    try {
      await connect(current.body.email, current.body.code).expect(400);
      await request(server)
        .get('/v1/integrations/hermes/telegram/connection')
        .set('Authorization', `Bearer ${serviceToken}`)
        .set('x-telegram-user-id', telegramId)
        .expect(404);
    } finally {
      await prisma.familyMembership.update({
        where: { familyId_userId: { familyId, userId } },
        data: { status: 'ACTIVE' },
      });
    }
    await connect(current.body.email, current.body.code).expect(201);
  });

  it('routes one shared bot to the verified household and rejects old confirmations after a switch', async () => {
    const server = app.getHttpServer();
    const otherTelegramId = String(Number(telegramId) + 1);
    const second = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Second household' })
      .expect(201);
    secondFamilyId = second.body.id;
    const otherFamilyId = second.body.id as string;
    await request(server)
      .post(`/v1/families/${otherFamilyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await prisma.familyMembership.create({
      data: { id: createId(), familyId: otherFamilyId, userId, role: 'MEMBER' },
    });
    const connect = async (family: string, actorToken: string, sender: string) => {
      const code = await request(server)
        .post(`/v1/families/${family}/finance/telegram/link`)
        .set('Authorization', `Bearer ${actorToken}`)
        .expect(201);
      return request(server)
        .post('/v1/integrations/hermes/telegram/connect')
        .set('Authorization', `Bearer ${serviceToken}`)
        .set('x-telegram-user-id', sender)
        .send({ email: code.body.email, code: code.body.code })
        .expect(201);
    };
    const tool = (sender: string, input: object) =>
      request(server)
        .post('/v1/integrations/hermes/tools')
        .set('Authorization', `Bearer ${serviceToken}`)
        .set('x-telegram-user-id', sender)
        .send(input);
    await connect(familyId, token, telegramId);
    await connect(otherFamilyId, otherToken, otherTelegramId);
    const a = await tool(telegramId, { tool: 'get_finance_context' }).expect(201);
    const b = await tool(otherTelegramId, { tool: 'get_finance_context' }).expect(201);
    expect(a.body.household.id).toBe(familyId);
    expect(a.body.households).toHaveLength(1);
    expect(b.body.household.id).toBe(otherFamilyId);
    await tool(telegramId, {
      tool: 'list_accounts',
      familyId: otherFamilyId,
      scope: 'HOUSEHOLD',
    }).expect(404);
    await tool(otherTelegramId, { tool: 'list_accounts', familyId, scope: 'HOUSEHOLD' }).expect(
      404,
    );
    const accounts: string[] = [];
    for (const [id, actorToken] of [
      [familyId, token],
      [otherFamilyId, otherToken],
    ]) {
      const account = await request(server)
        .post(`/v1/families/${id}/finance/accounts`)
        .set('Authorization', `Bearer ${actorToken}`)
        .send({ name: 'Shared wallet', type: 'CASH', scope: 'HOUSEHOLD' })
        .expect(201);
      accounts.push(account.body.id);
    }
    const drafts: string[] = [];
    for (const [index, sender] of [telegramId, otherTelegramId].entries()) {
      const result = await request(server)
        .post('/v1/integrations/telegram/webhook')
        .set('x-telegram-bot-api-secret-token', webhookSecret)
        .send({
          update_id: 80 + index,
          message: {
            from: { id: Number(sender) },
            chat: { id: Number(sender), type: 'private' },
            text: 'expense | 1200 | Food & Dining | Shared wallet | household | routed expense',
          },
        })
        .expect(200);
      const draft = await prisma.financeDraft.findUniqueOrThrow({
        where: { id: result.body.draftId },
      });
      expect(draft.familyId).toBe(index === 0 ? familyId : otherFamilyId);
      expect(draft.payload).toMatchObject({ accountId: accounts[index] });
      drafts.push(draft.id);
    }
    const confirmation = await tool(telegramId, {
      tool: 'confirm_transaction',
      familyId,
      draftId: drafts[0],
    }).expect(201);
    await connect(otherFamilyId, token, telegramId);
    await request(server)
      .post('/v1/integrations/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', webhookSecret)
      .send({
        update_id: 90,
        callback_query: {
          id: 'old-household',
          from: { id: Number(telegramId) },
          message: { chat: { id: Number(telegramId), type: 'private' } },
          data: confirmation.body.confirmation[0].callback_data,
        },
      })
      .expect(400);
    expect((await prisma.financeDraft.findUniqueOrThrow({ where: { id: drafts[0] } })).status).toBe(
      'PENDING_CONFIRMATION',
    );
    await request(server)
      .delete(`/v1/families/${familyId}/finance/telegram/link`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const stillConnected = await tool(telegramId, { tool: 'get_finance_context' }).expect(201);
    expect(stillConnected.body.household.id).toBe(otherFamilyId);
    const oldStatus = await request(server)
      .get(`/v1/families/${familyId}/finance/telegram`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(oldStatus.body).toEqual({
      linked: false,
      connectedElsewhere: true,
      requiresReconnect: false,
    });
    const reminder = await request(server)
      .post(`/v1/families/${familyId}/finance/schedules`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        scope: 'HOUSEHOLD',
        kind: 'REMINDER',
        title: 'Old household reminder',
        dueAt: '2026-12-02T08:00:00Z',
        timezone: 'UTC',
        recipientIds: [userId],
      })
      .expect(201);
    send.mockClear();
    await app.get(SchedulesService).run(new Date('2026-12-02T09:00:00Z'));
    expect(send).not.toHaveBeenCalled();
    expect(
      (await prisma.financeDelivery.findFirstOrThrow({ where: { scheduleId: reminder.body.id } }))
        .errorCode,
    ).toBe('TELEGRAM_NOT_LINKED');
    await request(server)
      .delete('/v1/integrations/hermes/telegram/connection')
      .set('Authorization', `Bearer ${serviceToken}`)
      .set('x-telegram-user-id', telegramId)
      .expect(200);
    await tool(telegramId, { tool: 'get_finance_context' }).expect(404);
    await tool(otherTelegramId, { tool: 'get_finance_context' }).expect(201);
  });
});
