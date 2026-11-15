import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { amountMinorSchema, financeDateSchema, positiveAmountMinorSchema } from '@ruma/validation';
import { loadApiEnv } from '../../config/env';

export const receiptExtractionSchema = z.object({
  merchant: z.string().max(200).optional(),
  date: financeDateSchema.optional(),
  totalMinor: positiveAmountMinorSchema.optional(),
  taxMinor: amountMinorSchema.optional(),
  currency: z.literal('IDR').optional(),
  confidence: z.number().min(0).max(1),
  lineItems: z
    .array(z.object({ description: z.string().max(200), amountMinor: amountMinorSchema }))
    .max(100)
    .optional(),
});
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

@Injectable()
export class ReceiptOcr {
  async extract(image: Buffer): Promise<ReceiptExtraction> {
    const env = loadApiEnv();
    if (!env.OCR_PROVIDER_URL || !env.OCR_PROVIDER_TOKEN)
      throw new ServiceUnavailableException({
        code: 'OCR_NOT_CONFIGURED',
        message: 'OCR is not configured. Enter receipt details manually.',
      });
    let response: Response;
    try {
      response = await fetch(env.OCR_PROVIDER_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(20000),
        headers: {
          Authorization: `Bearer ${env.OCR_PROVIDER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: image.toString('base64'), mimeType: 'image/jpeg' }),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'OCR_UNAVAILABLE',
        message: 'Receipt extraction is unavailable. Review the image manually.',
      });
    }
    if (!response.ok)
      throw new ServiceUnavailableException({
        code: 'OCR_UNAVAILABLE',
        message: 'Receipt extraction is unavailable.',
      });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ServiceUnavailableException({
        code: 'OCR_INVALID_RESPONSE',
        message: 'The image could not be interpreted. Enter receipt details manually.',
      });
    }
    const parsed = receiptExtractionSchema.safeParse(body);
    if (!parsed.success)
      throw new ServiceUnavailableException({
        code: 'OCR_INVALID_RESPONSE',
        message: 'The image could not be interpreted. Enter receipt details manually.',
      });
    return parsed.data;
  }
}
