import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, type FinanceScope } from '@prisma/client';
import type { DraftInput } from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { createId } from '../../common/ids';
import { requireFinanceMember, scopeWhere } from '../finance-access';
import { FinanceService } from '../finance.service';
import { DraftsService } from '../automation/drafts.service';
import { ReceiptOcr, type ReceiptExtraction } from './receipt-ocr';
import { normalizeReceipt, ReceiptStorage } from './receipt-storage';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ReceiptStorage,
    private readonly ocr: ReceiptOcr,
    private readonly drafts: DraftsService,
    private readonly finance: FinanceService,
  ) {}

  async list(familyId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    return {
      receipts: await this.prisma.financeReceipt.findMany({
        where: { familyId, ownerUserId: actorId },
        select: {
          id: true,
          scope: true,
          status: true,
          extraction: true,
          errorCode: true,
          transactionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    };
  }

  async upload(
    familyId: string,
    actorId: string,
    scope: FinanceScope,
    file: { buffer: Buffer; mimetype: string },
  ) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const image = await normalizeReceipt(file.buffer, file.mimetype);
    const sha256 = createHash('sha256').update(image).digest('hex');
    const duplicate = await this.prisma.financeReceipt.findUnique({
      where: { familyId_ownerUserId_sha256: { familyId, ownerUserId: actorId, sha256 } },
    });
    if (duplicate)
      throw new ConflictException({
        code: 'DUPLICATE_RECEIPT',
        message: 'This receipt has already been uploaded. Review the existing receipt.',
      });
    const id = createId(),
      storageKey = `${id}.jpg`;
    await this.storage.put(storageKey, image);
    try {
      await this.prisma.financeReceipt.create({
        data: { id, familyId, ownerUserId: actorId, scope, storageKey, sha256 },
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException({
          code: 'DUPLICATE_RECEIPT',
          message: 'This receipt has already been uploaded.',
        });
      throw error;
    }
    let extraction: ReceiptExtraction | undefined;
    let errorCode: string | null = null;
    try {
      extraction = await this.ocr.extract(image);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      const response = error.getResponse();
      errorCode =
        typeof response === 'object' && 'code' in response && typeof response.code === 'string'
          ? response.code
          : 'OCR_UNAVAILABLE';
    }
    const receipt = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financeReceipt.update({
        where: { id },
        data: {
          status: extraction && extraction.confidence >= 0.8 ? 'EXTRACTED' : 'NEEDS_REVIEW',
          extraction: extraction ?? {},
          errorCode,
        },
        select: { id: true, scope: true, status: true, extraction: true, errorCode: true },
      });
      await this.finance.audit(tx, familyId, actorId, id, 'RECEIPT_UPLOADED');
      return row;
    });
    return receipt;
  }

  async file(familyId: string, actorId: string, id: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const receipt = await this.prisma.financeReceipt.findFirst({
      where: {
        id,
        familyId,
        OR: [
          { ownerUserId: actorId },
          { scope: 'HOUSEHOLD', transaction: { deletedAt: null, scope: 'HOUSEHOLD' } },
        ],
      },
    });
    if (!receipt)
      throw new NotFoundException({ code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found.' });
    return this.storage.get(receipt.storageKey);
  }

  async draft(familyId: string, actorId: string, id: string, input: DraftInput) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const receipt = await this.prisma.financeReceipt.findFirst({
      where: { id, familyId, ownerUserId: actorId },
    });
    if (!receipt)
      throw new NotFoundException({ code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found.' });
    if (receipt.transactionId)
      throw new ConflictException({
        code: 'RECEIPT_CONFIRMED',
        message: 'This receipt already belongs to a transaction.',
      });
    if ((input.transaction.scope ?? 'HOUSEHOLD') !== receipt.scope)
      throw new BadRequestException({
        code: 'SCOPE_MISMATCH',
        message: 'Receipt and draft scope must match.',
      });
    const draft = await this.drafts.create(
      familyId,
      actorId,
      { ...input, idempotencyKey: `receipt:${id}` },
      'RECEIPT',
      id,
    );
    const possibleDuplicate = await this.prisma.transaction.findFirst({
      where: {
        ...scopeWhere(familyId, actorId, receipt.scope),
        deletedAt: null,
        type: input.transaction.type,
        amountMinor: BigInt(input.transaction.amountMinor),
        transactionDate: new Date(`${input.transaction.transactionDate}T00:00:00Z`),
      },
      select: { id: true },
    });
    return { draft, possibleDuplicateTransactionId: possibleDuplicate?.id ?? null };
  }
}
