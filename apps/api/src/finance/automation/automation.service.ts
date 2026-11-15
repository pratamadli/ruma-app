import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  createTransactionSchema,
  telegramConnectSchema,
  type CreateTransactionInput,
  type HermesToolInput,
  type TelegramUpdate,
} from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { loadApiEnv } from '../../config/env';
import { FinanceService } from '../finance.service';
import { requireFinanceMember } from '../finance-access';
import { DraftsService } from './drafts.service';
import { sameSecret } from './integration-auth';
import { TelegramClient } from './telegram.client';

type Interpretation = { clarification: string } | { transaction: CreateTransactionInput };

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly drafts: DraftsService,
    private readonly telegram: TelegramClient,
  ) {}

  async tool(telegramId: string, input: HermesToolInput) {
    const connection = await this.drafts.connection(telegramId);
    const actorId = connection.userId;
    if (input.tool === 'get_finance_context') {
      return {
        userId: actorId,
        household: connection.household,
        households: [connection.household],
      };
    }
    if (input.familyId !== connection.household.id)
      throw new NotFoundException({
        code: 'HOUSEHOLD_NOT_LINKED',
        message: 'Connect to this household from its dashboard first.',
      });
    await requireFinanceMember(this.prisma, input.familyId, actorId);
    switch (input.tool) {
      case 'list_accounts':
        return this.finance.listAccounts(input.familyId, actorId, input.scope);
      case 'list_categories':
        return this.finance.listCategories(input.familyId);
      case 'get_monthly_summary':
        return this.finance.getSummary(input.familyId, input.query, actorId);
      case 'create_transaction_draft': {
        const draft = await this.drafts.create(input.familyId, actorId, input.input);
        return { draft, confirmation: this.buttons(draft.id, actorId) };
      }
      case 'confirm_transaction': {
        const draft = await this.drafts.get(input.familyId, actorId, input.draftId);
        return draft.status === 'CONFIRMED'
          ? { status: draft.status, transactionId: draft.transactionId }
          : {
              status: draft.status,
              confirmationRequired: true,
              confirmation: this.buttons(draft.id, actorId),
            };
      }
    }
  }

  buttons(id: string, actorId: string) {
    const secret = loadApiEnv().TELEGRAM_WEBHOOK_SECRET;
    if (!secret)
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_UNAVAILABLE',
        message: 'Telegram confirmation is not configured.',
      });
    const token = createHmac('sha256', secret)
      .update(`${id}:${actorId}`)
      .digest('base64url')
      .slice(0, 22);
    return [
      { text: 'Confirm', callback_data: `yes:${id}:${token}` },
      { text: 'Cancel', callback_data: `no:${id}:${token}` },
    ];
  }

  async webhook(update: TelegramUpdate) {
    const callback = update.callback_query;
    if (callback) {
      const telegramId = String(callback.from.id);
      if (
        callback.message.chat.type !== 'private' ||
        callback.message.chat.id !== callback.from.id
      ) {
        throw new BadRequestException({
          code: 'PRIVATE_CHAT_REQUIRED',
          message: 'Finance confirmations require a private chat.',
        });
      }
      const connection = await this.drafts.connection(telegramId);
      const actorId = connection.userId;
      const [action, id] = callback.data.split(':');
      if (
        !id ||
        !['yes', 'no'].includes(action ?? '') ||
        !this.buttons(id, actorId).some((button) => sameSecret(button.callback_data, callback.data))
      ) {
        throw new BadRequestException({
          code: 'INVALID_CONFIRMATION',
          message: 'Confirmation does not match this draft.',
        });
      }
      const draft = await this.prisma.financeDraft.findFirst({
        where: { id, ownerUserId: actorId, familyId: connection.household.id },
      });
      if (!draft)
        throw new BadRequestException({
          code: 'INVALID_CONFIRMATION',
          message: 'Draft not found.',
        });
      const result =
        action === 'yes'
          ? await this.drafts.confirm(draft.familyId, actorId, id)
          : await this.drafts.cancel(draft.familyId, actorId, id);
      await this.telegram.send(
        telegramId,
        action === 'yes'
          ? 'Transaction confirmed in RUMA.'
          : 'Draft cancelled. No transaction was saved.',
      );
      return result;
    }
    const message = update.message;
    if (!message?.text) return { ignored: true, reason: 'Use text or review a draft in RUMA.' };
    if (message.chat.type !== 'private' || message.chat.id !== message.from.id) {
      throw new BadRequestException({
        code: 'PRIVATE_CHAT_REQUIRED',
        message: 'Finance messages require a private chat.',
      });
    }
    const telegramId = String(message.from.id);
    const parts = message.text.trim().split(/\s+/);
    const command = parts[0]?.split('@')[0];
    const credentials = command === '/ruma' && parts[1] === 'connect' ? parts.slice(2) : parts;
    if (
      (command === '/ruma' && parts[1] === 'connect') ||
      (credentials.length === 2 && credentials[0]?.includes('@'))
    ) {
      const parsed = telegramConnectSchema.safeParse({
        email: credentials[0],
        code: credentials[1],
      });
      if (!parsed.success || credentials.length !== 2)
        throw new BadRequestException({
          code: 'LINK_INVALID',
          message:
            'Send /ruma connect followed by your RUMA email and the code from your household dashboard.',
        });
      const result = await this.drafts.consumeLink(parsed.data, telegramId);
      await this.telegram.send(
        telegramId,
        `Connected to RUMA household: ${result.household.name}. Financial writes always require confirmation.`,
      );
      return result;
    }
    if (
      command === '/start' ||
      (command === '/ruma' && !['status', 'disconnect'].includes(parts[1] ?? ''))
    ) {
      await this.telegram.send(
        telegramId,
        'Open your household dashboard > Connect to Telegram. Then send /ruma connect, your RUMA email and the one-time code in this private chat.',
      );
      return { clarificationRequired: true };
    }
    const connection = await this.drafts.connection(telegramId);
    const actorId = connection.userId,
      family = connection.household;
    if (command === '/ruma' && parts[1] === 'status') {
      await this.telegram.send(telegramId, `Connected household: ${family.name}.`);
      return { linked: true, household: family };
    }
    if (command === '/ruma' && parts[1] === 'disconnect') {
      await this.drafts.unlink(family.id, actorId);
      await this.telegram.send(
        telegramId,
        'Disconnected from RUMA. Your household data has not been deleted.',
      );
      return { linked: false };
    }
    let input;
    if (message.text.includes('|'))
      input = await this.structured(family.id, actorId, family.timezone, message.text);
    else input = await this.interpret(message.text, family.id, actorId, family.timezone);
    if ('clarification' in input) {
      await this.telegram.send(telegramId, input.clarification);
      return { clarificationRequired: true };
    }
    const draft = await this.drafts.create(family.id, actorId, {
      transaction: input.transaction,
      idempotencyKey: `telegram-update:${update.update_id}`,
    });
    const accounts = await this.finance.listAccounts(family.id, actorId, input.transaction.scope);
    const categories = await this.finance.listCategories(family.id);
    const account = accounts.accounts.find((a) => a.id === input.transaction.accountId);
    const category = categories.categories.find((c) => c.id === input.transaction.categoryId);
    await this.telegram.send(
      telegramId,
      `${family.name}\n${input.transaction.type}: IDR ${input.transaction.amountMinor}\n${input.transaction.scope ?? 'HOUSEHOLD'} · ${input.transaction.transactionDate}\nAccount: ${account?.name ?? 'Review in RUMA'}\nCategory: ${category?.name ?? 'None'}\n${input.transaction.description ?? ''}\nConfirm this draft or cancel to correct it.`,
      this.buttons(draft.id, actorId),
    );
    return { draftId: draft.id, status: draft.status };
  }

  private async structured(
    familyId: string,
    actorId: string,
    timezone: string,
    text: string,
  ): Promise<Interpretation> {
    const [type, amount, categoryName, accountName, scopeName, description] = text
      .split('|')
      .map((part) => part.trim());
    if (
      text.split('|').length !== 6 ||
      !type ||
      !['expense', 'income'].includes(type.toLowerCase()) ||
      !amount ||
      !['personal', 'household'].includes(scopeName?.toLowerCase() ?? '')
    ) {
      return { clarification: 'Use: expense | 45000 | Food & Dining | GoPay | household | lunch' };
    }
    const scope =
      scopeName!.toLowerCase() === 'personal' ? ('PERSONAL' as const) : ('HOUSEHOLD' as const);
    const accounts = (await this.finance.listAccounts(familyId, actorId, scope)).accounts.filter(
      (a) => a.isActive && a.name.toLowerCase() === accountName?.toLowerCase(),
    );
    const categories = (await this.finance.listCategories(familyId)).categories.filter(
      (c) =>
        c.isActive &&
        c.kind === type.toUpperCase() &&
        c.name.toLowerCase() === categoryName?.toLowerCase(),
    );
    if (accounts.length !== 1 || categories.length !== 1)
      return {
        clarification: 'Account or category is missing or ambiguous. Use the exact name from RUMA.',
      };
    const parsed = createTransactionSchema.safeParse({
      type: type.toUpperCase(),
      amountMinor: amount,
      scope,
      accountId: accounts[0]!.id,
      categoryId: categories[0]!.id,
      transactionDate: localDate(timezone),
      description,
    });
    return parsed.success
      ? { transaction: parsed.data }
      : { clarification: 'Enter a positive whole-rupiah amount and valid transaction details.' };
  }

  private async interpret(
    text: string,
    familyId: string,
    actorId: string,
    timezone: string,
  ): Promise<Interpretation> {
    const env = loadApiEnv();
    if (!env.HERMES_INTENT_URL || !env.HERMES_INTENT_TOKEN)
      return {
        clarification:
          'Natural-language capture is not configured. Use: expense | 45000 | Food & Dining | GoPay | household | lunch',
      };
    let response: Response;
    try {
      response = await fetch(env.HERMES_INTENT_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${env.HERMES_INTENT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          familyId,
          userId: actorId,
          localDate: localDate(timezone),
          instruction:
            'Return transaction fields or clarification; never confirm or claim a write.',
        }),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'HERMES_UNAVAILABLE',
        message: 'Interpretation is unavailable. Use structured input or the web.',
      });
    }
    if (!response.ok)
      throw new ServiceUnavailableException({
        code: 'HERMES_UNAVAILABLE',
        message: 'Interpretation is unavailable.',
      });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException({
        code: 'HERMES_INVALID_RESPONSE',
        message: 'Interpretation returned an invalid response. Use structured input or the web.',
      });
    }
    if (
      body &&
      typeof body === 'object' &&
      'clarification' in body &&
      typeof body.clarification === 'string'
    )
      return { clarification: body.clarification.slice(0, 500) };
    const parsed = createTransactionSchema.safeParse(
      body && typeof body === 'object' && 'transaction' in body ? body.transaction : null,
    );
    if (
      !parsed.success ||
      !parsed.data.scope ||
      (['INCOME', 'EXPENSE'].includes(parsed.data.type) && !parsed.data.categoryId)
    )
      return {
        clarification: 'Please specify amount, account, category and personal/household scope.',
      };
    return { transaction: parsed.data };
  }
}

function localDate(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}
