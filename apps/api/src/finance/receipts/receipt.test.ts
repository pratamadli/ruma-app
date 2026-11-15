import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { normalizeReceipt, RECEIPT_MAX_BYTES } from './receipt-storage';
import { ReceiptOcr, receiptExtractionSchema } from './receipt-ocr';
import { apiEnvSchema } from '@ruma/validation';
import * as environment from '../../config/env';

describe('receipt boundary', () => {
  it('decodes and normalizes images, rejecting spoofed MIME and malformed content', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const normalized = await normalizeReceipt(png, 'image/png');
    expect((await sharp(normalized).metadata()).format).toBe('jpeg');
    await expect(normalizeReceipt(png, 'image/jpeg')).rejects.toThrow();
    await expect(
      normalizeReceipt(Buffer.from('<script>bad</script>'), 'image/png'),
    ).rejects.toThrow();
    await expect(
      normalizeReceipt(Buffer.alloc(RECEIPT_MAX_BYTES + 1), 'image/png'),
    ).rejects.toThrow();
    await expect(normalizeReceipt(png.subarray(0, 20), 'image/png')).rejects.toThrow();
  });
  it('rejects invalid extracted dates, amounts and confidence', () => {
    expect(
      receiptExtractionSchema.safeParse({ date: '2026-02-30', totalMinor: '-4', confidence: 2 })
        .success,
    ).toBe(false);
    expect(receiptExtractionSchema.parse({ totalMinor: '45000', confidence: 0.3 }).confidence).toBe(
      0.3,
    );
  });
  it('surfaces malformed provider JSON as an explicit manual-review error', async () => {
    const env = vi.spyOn(environment, 'loadApiEnv').mockReturnValue(
      apiEnvSchema.parse({
        DATABASE_URL: 'postgresql://localhost/test',
        JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters!!',
        JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters!',
        OCR_PROVIDER_URL: 'https://ocr.example.test/extract',
        OCR_PROVIDER_TOKEN: 'test-provider-token-long-enough',
      }),
    );
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json'));
    try {
      await expect(new ReceiptOcr().extract(Buffer.from('test-image'))).rejects.toMatchObject({
        response: { code: 'OCR_INVALID_RESPONSE' },
      });
    } finally {
      fetchMock.mockRestore();
      env.mockRestore();
    }
  });
});
