import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BulkImportCandidatesInput,
  CompleteGmailOAuthInput,
  ConfirmImportCandidateInput,
  ConnectSyntheticEmailInput,
  ImportSyncInput,
  ListImportCandidatesQuery,
  UpdateImportCandidateInput,
} from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { createId } from '../../common/ids';
import { captureException } from '../../observability/sentry';
import { FinanceService } from '../finance.service';
import { formatDateOnly, moneyToString, parseDateOnly } from '../money';
import { createGmailOAuthState, verifyGmailOAuthState } from './oauth-state';
import { parseTransactionEmail } from './parsers';
import { GmailEmailProvider } from './providers/gmail.provider';
import { SyntheticEmailProvider } from './providers/synthetic.provider';
import { decryptToken, encryptToken, fingerprintCandidate } from './token-crypto';
import type { EmailProvider, RawEmailMessage } from './types';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
  ) {}

  async listConnections(familyId: string) {
    const connections = await this.prisma.emailConnection.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        provider: true,
        status: true,
        emailAddress: true,
        scopes: true,
        lastSyncedAt: true,
        lastError: true,
        connectedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      connections: connections.map((c) => ({
        ...c,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      gmailConfigured: GmailEmailProvider.isConfigured(),
    };
  }

  async connectSynthetic(familyId: string, actorId: string, input: ConnectSyntheticEmailInput) {
    const emailAddress = input.emailAddress?.trim() || 'demo@synthetic-bank.example.test';
    const existing = await this.prisma.emailConnection.findFirst({
      where: { familyId, provider: 'SYNTHETIC', emailAddress },
    });
    if (existing) {
      const updated = await this.prisma.emailConnection.update({
        where: { id: existing.id },
        data: {
          status: 'CONNECTED',
          lastError: null,
          connectedById: actorId,
        },
      });
      return this.toConnectionResponse(updated);
    }

    const created = await this.prisma.emailConnection.create({
      data: {
        id: createId(),
        familyId,
        provider: 'SYNTHETIC',
        status: 'CONNECTED',
        emailAddress,
        connectedById: actorId,
        scopes: 'synthetic:fixtures',
      },
    });
    return this.toConnectionResponse(created);
  }

  getGmailAuthUrl(familyId: string, actorId: string) {
    const state = createGmailOAuthState(familyId, actorId);
    return { url: GmailEmailProvider.authUrl(state), state };
  }

  async completeGmailOAuth(familyId: string, actorId: string, input: CompleteGmailOAuthInput) {
    if (!GmailEmailProvider.isConfigured()) {
      throw new BadRequestException({
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'Gmail OAuth is not configured on this server.',
      });
    }
    verifyGmailOAuthState(input.state, { familyId, actorId });

    const tokens = await GmailEmailProvider.exchangeCode(input.code);
    const accessEnc = encryptToken(tokens.accessToken);
    const refreshEnc = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;
    if (!accessEnc) {
      throw new BadRequestException({
        code: 'TOKEN_ENCRYPTION_REQUIRED',
        message: 'EMAIL_TOKEN_ENCRYPTION_KEY must be configured to connect Gmail.',
      });
    }

    const existing = await this.prisma.emailConnection.findFirst({
      where: {
        familyId,
        provider: 'GMAIL',
        emailAddress: tokens.emailAddress,
      },
    });

    const data = {
      status: 'CONNECTED' as const,
      accessTokenEncrypted: accessEnc,
      // Preserve prior refresh token if Google did not return a new one.
      refreshTokenEncrypted: refreshEnc ?? existing?.refreshTokenEncrypted ?? null,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      lastError: null,
      connectedById: actorId,
    };

    const row = existing
      ? await this.prisma.emailConnection.update({ where: { id: existing.id }, data })
      : await this.prisma.emailConnection.create({
          data: {
            id: createId(),
            familyId,
            provider: 'GMAIL',
            emailAddress: tokens.emailAddress,
            ...data,
          },
        });

    this.logger.log(
      JSON.stringify({
        event: 'gmail_connected',
        familyId,
        connectionId: row.id,
      }),
    );

    return this.toConnectionResponse(row);
  }

  async disconnect(familyId: string, connectionId: string) {
    const connection = await this.requireConnection(familyId, connectionId);

    // Best-effort provider revoke; always clear local credentials.
    if (connection.provider === 'GMAIL') {
      const token =
        (connection.accessTokenEncrypted ? decryptToken(connection.accessTokenEncrypted) : null) ??
        (connection.refreshTokenEncrypted ? decryptToken(connection.refreshTokenEncrypted) : null);
      if (token) {
        await GmailEmailProvider.revokeToken(token);
      }
    }

    const updated = await this.prisma.emailConnection.update({
      where: { id: connection.id },
      data: {
        status: 'DISCONNECTED',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        lastError: null,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'email_disconnected',
        familyId,
        connectionId: connection.id,
        provider: connection.provider,
      }),
    );

    return this.toConnectionResponse(updated);
  }

  async sync(familyId: string, connectionId: string, input: ImportSyncInput) {
    const connection = await this.requireConnection(familyId, connectionId);
    if (connection.status !== 'CONNECTED') {
      throw new BadRequestException({
        code: 'CONNECTION_NOT_ACTIVE',
        message: 'Reconnect email before syncing.',
      });
    }

    const lookbackDays = input.lookbackDays;
    const started = Date.now();
    let messagesScanned = 0;
    let candidatesCreated = 0;
    let alreadyProcessed = 0;
    let parseFailures = 0;
    let skippedUnknown = 0;
    let messageFetchFailures = 0;
    let truncated = false;

    try {
      const provider = this.resolveProvider(connection.provider);
      let accessToken: string | undefined;

      if (connection.provider === 'GMAIL') {
        accessToken = await this.resolveGmailAccessToken(connection);
      }

      const listed = await provider.listMessages({
        lookbackDays,
        accessToken,
      });
      messagesScanned = listed.messages.length;
      messageFetchFailures = listed.messageFetchFailures;
      truncated = listed.truncated;

      for (const message of listed.messages) {
        const existing = await this.prisma.importCandidate.findUnique({
          where: {
            connectionId_providerMessageId: {
              connectionId: connection.id,
              providerMessageId: message.providerMessageId,
            },
          },
        });
        if (existing) {
          alreadyProcessed += 1;
          continue;
        }

        const parsed = parseTransactionEmail(message);
        if (!parsed) {
          skippedUnknown += 1;
          continue;
        }

        try {
          const created = await this.createCandidateFromParse(
            familyId,
            connection.id,
            message,
            parsed,
          );
          if (created.status === 'FAILED') parseFailures += 1;
          else candidatesCreated += 1;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            alreadyProcessed += 1;
            continue;
          }
          throw error;
        }
      }

      await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date(), lastError: null, status: 'CONNECTED' },
      });

      const status = messageFetchFailures > 0 || truncated ? 'PARTIAL' : 'COMPLETED';

      this.logger.log(
        JSON.stringify({
          event: 'import_sync',
          familyId,
          connectionId: connection.id,
          provider: connection.provider,
          lookbackDays,
          durationMs: Date.now() - started,
          messagesScanned,
          candidatesCreated,
          alreadyProcessed,
          parseFailures,
          skippedUnknown,
          messageFetchFailures,
          truncated,
          status,
        }),
      );

      return {
        connectionId: connection.id,
        lookbackDays,
        messagesScanned,
        candidatesCreated,
        alreadyProcessed,
        parseFailures,
        skippedUnknown,
        messageFetchFailures,
        truncated,
        status,
      };
    } catch (error) {
      const response = error instanceof BadRequestException ? error.getResponse() : null;
      const code =
        typeof response === 'object' && response && 'code' in response
          ? String((response as { code?: string }).code)
          : 'UNKNOWN_ERROR';
      const message =
        typeof response === 'object' && response && 'message' in response
          ? String((response as { message?: string }).message)
          : 'Sync failed';

      const authFailure = code.includes('AUTH') || code === 'AUTHENTICATION_ERROR';

      await this.prisma.emailConnection.update({
        where: { id: connection.id },
        data: {
          lastError: message.slice(0, 200),
          status: authFailure ? 'ERROR' : connection.status,
        },
      });

      captureException(error, {
        event: 'import_sync_failed',
        familyId,
        connectionId: connection.id,
        code,
      });

      throw error;
    }
  }

  private async resolveGmailAccessToken(connection: {
    id: string;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
  }): Promise<string> {
    const access = connection.accessTokenEncrypted
      ? decryptToken(connection.accessTokenEncrypted)
      : null;
    const refresh = connection.refreshTokenEncrypted
      ? decryptToken(connection.refreshTokenEncrypted)
      : null;

    const expiresSoon =
      connection.tokenExpiresAt != null &&
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (access && !expiresSoon) return access;

    if (!refresh) {
      throw new BadRequestException({
        code: 'AUTHENTICATION_ERROR',
        message: 'Gmail connection needs to be re-authorized.',
      });
    }

    const refreshed = await GmailEmailProvider.refreshAccessToken(refresh);
    const accessEnc = encryptToken(refreshed.accessToken);
    if (!accessEnc) {
      throw new BadRequestException({
        code: 'TOKEN_ENCRYPTION_REQUIRED',
        message: 'EMAIL_TOKEN_ENCRYPTION_KEY must be configured to connect Gmail.',
      });
    }
    await this.prisma.emailConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: accessEnc,
        tokenExpiresAt: refreshed.expiresAt,
        lastError: null,
        status: 'CONNECTED',
      },
    });
    return refreshed.accessToken;
  }

  async listCandidates(familyId: string, query: ListImportCandidatesQuery) {
    const where = {
      familyId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [candidates, counts] = await Promise.all([
      this.prisma.importCandidate.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.importCandidate.groupBy({
        by: ['status'],
        where: { familyId },
        _count: { _all: true },
      }),
    ]);

    const history = {
      pendingReview: 0,
      confirmed: 0,
      ignored: 0,
      failed: 0,
    };
    for (const row of counts) {
      if (row.status === 'PENDING_REVIEW') history.pendingReview = row._count._all;
      if (row.status === 'CONFIRMED') history.confirmed = row._count._all;
      if (row.status === 'IGNORED') history.ignored = row._count._all;
      if (row.status === 'FAILED') history.failed = row._count._all;
    }

    return {
      candidates: candidates.map((c) => this.toCandidateResponse(c)),
      history,
    };
  }

  async getCandidate(familyId: string, candidateId: string) {
    const candidate = await this.requireCandidate(familyId, candidateId);
    return this.toCandidateResponse(candidate);
  }

  async updateCandidate(familyId: string, candidateId: string, input: UpdateImportCandidateInput) {
    const candidate = await this.requireCandidate(familyId, candidateId);
    if (candidate.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        code: 'CANDIDATE_NOT_EDITABLE',
        message: 'Only pending import candidates can be edited.',
      });
    }

    const updated = await this.prisma.importCandidate.update({
      where: { id: candidate.id },
      data: {
        transactionType: input.transactionType ?? undefined,
        amountMinor: input.amountMinor !== undefined ? BigInt(input.amountMinor) : undefined,
        currency: input.currency ?? undefined,
        transactionDate:
          input.transactionDate !== undefined ? parseDateOnly(input.transactionDate) : undefined,
        description: input.description === undefined ? undefined : input.description,
        merchant: input.merchant === undefined ? undefined : input.merchant,
        suggestedAccountId: input.accountId === undefined ? undefined : input.accountId,
        suggestedCategoryId: input.categoryId === undefined ? undefined : input.categoryId,
        suggestedTransferAccountId:
          input.transferAccountId === undefined ? undefined : input.transferAccountId,
        categoryHint: input.categoryHint === undefined ? undefined : input.categoryHint,
      },
    });
    return this.toCandidateResponse(updated);
  }

  async confirm(
    familyId: string,
    actorId: string,
    candidateId: string,
    input: ConfirmImportCandidateInput,
  ) {
    const candidate = await this.requireCandidate(familyId, candidateId);
    if (candidate.status !== 'PENDING_REVIEW') {
      throw new BadRequestException({
        code: 'CANDIDATE_NOT_CONFIRMABLE',
        message: 'Only pending import candidates can be confirmed.',
      });
    }

    const type = input.transactionType ?? candidate.transactionType;
    const amountMinor = input.amountMinor ?? candidate.amountMinor?.toString() ?? null;
    const transactionDate =
      input.transactionDate ??
      (candidate.transactionDate ? formatDateOnly(candidate.transactionDate) : null);
    const accountId = input.accountId ?? candidate.suggestedAccountId;
    const categoryId =
      input.categoryId !== undefined ? input.categoryId : candidate.suggestedCategoryId;
    const transferAccountId =
      input.transferAccountId !== undefined
        ? input.transferAccountId
        : candidate.suggestedTransferAccountId;
    const description =
      input.description !== undefined
        ? input.description
        : (candidate.description ?? candidate.merchant);
    const currency = input.currency ?? candidate.currency ?? 'IDR';

    if (!type || !amountMinor || !transactionDate || !accountId) {
      throw new BadRequestException({
        code: 'CANDIDATE_INCOMPLETE',
        message: 'Type, amount, date, and account are required to confirm.',
      });
    }
    if (currency !== 'IDR') {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Only IDR imports can be confirmed in this release.',
      });
    }
    if (type === 'TRANSFER' && !transferAccountId) {
      throw new BadRequestException({
        code: 'TRANSFER_ACCOUNT_REQUIRED',
        message: 'Choose source and destination accounts before confirming a transfer.',
      });
    }

    const txn = await this.finance.createLedgerTransaction(
      familyId,
      actorId,
      {
        type,
        amountMinor,
        accountId,
        transferAccountId: type === 'TRANSFER' ? transferAccountId! : undefined,
        categoryId: type === 'TRANSFER' ? null : (categoryId ?? null),
        description: description ?? undefined,
        transactionDate,
        currency,
      },
      {
        source: 'IMPORT',
        sourceReference: `candidate:${candidate.id}`,
      },
    );

    const updated = await this.prisma.importCandidate.update({
      where: { id: candidate.id },
      data: {
        status: 'CONFIRMED',
        confirmedTransactionId: txn.id,
        reviewedById: actorId,
        reviewedAt: new Date(),
        transactionType: type,
        amountMinor: BigInt(amountMinor),
        currency,
        transactionDate: parseDateOnly(transactionDate),
        description: description ?? null,
        suggestedAccountId: accountId,
        suggestedCategoryId: type === 'TRANSFER' ? null : (categoryId ?? null),
        suggestedTransferAccountId: type === 'TRANSFER' ? transferAccountId! : null,
      },
    });

    return {
      candidate: this.toCandidateResponse(updated),
      transaction: txn,
    };
  }

  async ignore(familyId: string, actorId: string, candidateId: string) {
    const candidate = await this.requireCandidate(familyId, candidateId);
    if (candidate.status !== 'PENDING_REVIEW' && candidate.status !== 'FAILED') {
      throw new BadRequestException({
        code: 'CANDIDATE_NOT_IGNORABLE',
        message: 'This import candidate cannot be ignored.',
      });
    }
    const updated = await this.prisma.importCandidate.update({
      where: { id: candidate.id },
      data: {
        status: 'IGNORED',
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    return this.toCandidateResponse(updated);
  }

  /**
   * Bulk ignore only — safe and reversible via future re-sync of ignored status.
   * Bulk confirm is deferred (transfers / incomplete accounts are too risky).
   */
  async bulkIgnore(familyId: string, actorId: string, input: BulkImportCandidatesInput) {
    const candidates = await this.prisma.importCandidate.findMany({
      where: {
        familyId,
        id: { in: input.candidateIds },
        status: { in: ['PENDING_REVIEW', 'FAILED'] },
      },
    });
    const now = new Date();
    await this.prisma.importCandidate.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: {
        status: 'IGNORED',
        reviewedById: actorId,
        reviewedAt: now,
      },
    });
    return {
      ignored: candidates.length,
      skipped: input.candidateIds.length - candidates.length,
    };
  }

  private async createCandidateFromParse(
    familyId: string,
    connectionId: string,
    message: RawEmailMessage,
    parsed: NonNullable<ReturnType<typeof parseTransactionEmail>>,
  ) {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { familyId, isActive: true },
    });
    const categories = await this.prisma.transactionCategory.findMany({
      where: { familyId, isActive: true },
    });

    const suggestedAccountId = matchAccount(accounts, parsed.accountHint);
    const suggestedCategoryId = matchCategory(
      categories,
      parsed.categoryHint,
      parsed.transactionType,
    );

    const fingerprint =
      parsed.amountMinor != null && parsed.transactionDate && parsed.transactionType
        ? fingerprintCandidate({
            type: parsed.transactionType,
            amountMinor: parsed.amountMinor,
            transactionDate: parsed.transactionDate,
            description: parsed.description,
            merchant: parsed.merchant,
          })
        : null;

    let possibleDuplicateTransactionId: string | null = null;
    if (fingerprint) {
      const dup = await this.prisma.transaction.findFirst({
        where: {
          familyId,
          deletedAt: null,
          type: parsed.transactionType!,
          amountMinor: parsed.amountMinor!,
          transactionDate: parseDateOnly(parsed.transactionDate!),
        },
        orderBy: { createdAt: 'desc' },
      });
      if (dup) {
        const dupFp = fingerprintCandidate({
          type: dup.type,
          amountMinor: dup.amountMinor,
          transactionDate: formatDateOnly(dup.transactionDate),
          description: dup.description,
          merchant: null,
        });
        if (dupFp === fingerprint) {
          possibleDuplicateTransactionId = dup.id;
        }
      }
    }

    const failed = Boolean(parsed.parseError) || !parsed.amountMinor || !parsed.transactionType;

    return this.prisma.importCandidate.create({
      data: {
        id: createId(),
        familyId,
        connectionId,
        providerMessageId: message.providerMessageId,
        parserProvider: parsed.parserProvider,
        status: failed ? 'FAILED' : 'PENDING_REVIEW',
        confidence: parsed.confidence,
        transactionType: parsed.transactionType,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        transactionDate: parsed.transactionDate ? parseDateOnly(parsed.transactionDate) : null,
        description: parsed.description,
        merchant: parsed.merchant,
        reference: parsed.reference,
        accountHint: parsed.accountHint,
        categoryHint: parsed.categoryHint,
        suggestedAccountId,
        suggestedCategoryId,
        suggestedTransferAccountId: null,
        fingerprint,
        possibleDuplicateTransactionId,
        parseError: parsed.parseError,
      },
    });
  }

  private resolveProvider(kind: 'SYNTHETIC' | 'GMAIL'): EmailProvider {
    if (kind === 'SYNTHETIC') return new SyntheticEmailProvider();
    return new GmailEmailProvider();
  }

  private async requireConnection(familyId: string, connectionId: string) {
    const connection = await this.prisma.emailConnection.findFirst({
      where: { id: connectionId, familyId },
    });
    if (!connection) {
      throw new NotFoundException({
        code: 'EMAIL_CONNECTION_NOT_FOUND',
        message: 'Email connection not found.',
      });
    }
    return connection;
  }

  private async requireCandidate(familyId: string, candidateId: string) {
    const candidate = await this.prisma.importCandidate.findFirst({
      where: { id: candidateId, familyId },
    });
    if (!candidate) {
      throw new NotFoundException({
        code: 'IMPORT_CANDIDATE_NOT_FOUND',
        message: 'Import candidate not found.',
      });
    }
    return candidate;
  }

  private toConnectionResponse(row: {
    id: string;
    familyId: string;
    provider: string;
    status: string;
    emailAddress: string;
    scopes: string | null;
    lastSyncedAt: Date | null;
    lastError: string | null;
    connectedById: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      familyId: row.familyId,
      provider: row.provider,
      status: row.status,
      emailAddress: row.emailAddress,
      scopes: row.scopes,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      lastError: row.lastError,
      connectedById: row.connectedById,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toCandidateResponse(row: {
    id: string;
    familyId: string;
    connectionId: string;
    providerMessageId: string;
    parserProvider: string;
    status: string;
    confidence: string;
    transactionType: string | null;
    amountMinor: bigint | null;
    currency: string | null;
    transactionDate: Date | null;
    description: string | null;
    merchant: string | null;
    reference: string | null;
    accountHint: string | null;
    categoryHint: string | null;
    suggestedAccountId: string | null;
    suggestedCategoryId: string | null;
    suggestedTransferAccountId: string | null;
    fingerprint: string | null;
    possibleDuplicateTransactionId: string | null;
    confirmedTransactionId: string | null;
    parseError: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      familyId: row.familyId,
      connectionId: row.connectionId,
      providerMessageId: row.providerMessageId,
      parserProvider: row.parserProvider,
      status: row.status,
      confidence: row.confidence,
      transactionType: row.transactionType,
      amountMinor: row.amountMinor != null ? moneyToString(row.amountMinor) : null,
      currency: row.currency,
      transactionDate: row.transactionDate ? formatDateOnly(row.transactionDate) : null,
      description: row.description,
      merchant: row.merchant,
      reference: row.reference,
      accountHint: row.accountHint,
      categoryHint: row.categoryHint,
      suggestedAccountId: row.suggestedAccountId,
      suggestedCategoryId: row.suggestedCategoryId,
      suggestedTransferAccountId: row.suggestedTransferAccountId,
      possibleDuplicateTransactionId: row.possibleDuplicateTransactionId,
      confirmedTransactionId: row.confirmedTransactionId,
      parseError: row.parseError,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function matchAccount(
  accounts: Array<{ id: string; name: string }>,
  hint: string | null,
): string | null {
  if (!hint) return accounts.length === 1 ? accounts[0]!.id : null;
  const needle = hint.toLowerCase();
  const matches = accounts.filter((a) => a.name.toLowerCase().includes(needle));
  if (matches.length === 1) return matches[0]!.id;
  return null;
}

function matchCategory(
  categories: Array<{ id: string; name: string; kind: string }>,
  hint: string | null,
  type: string | null,
): string | null {
  if (!hint || !type || type === 'TRANSFER') return null;
  const needle = hint.toLowerCase();
  const match = categories.find((c) => c.kind === type && c.name.toLowerCase() === needle);
  return match?.id ?? null;
}
