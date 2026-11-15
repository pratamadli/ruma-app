import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { loadApiEnv } from '../../config/env';

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export async function normalizeReceipt(buffer: Buffer, mime: string) {
  if (
    !buffer.length ||
    buffer.length > RECEIPT_MAX_BYTES ||
    !['image/png', 'image/jpeg'].includes(mime)
  ) {
    throw new BadRequestException({
      code: 'INVALID_RECEIPT',
      message: 'Upload a PNG or JPEG receipt up to 5 MB.',
    });
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (
      (mime === 'image/png' && metadata.format !== 'png') ||
      (mime === 'image/jpeg' && metadata.format !== 'jpeg') ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Invalid format');
    return await image.rotate().jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new BadRequestException({
      code: 'INVALID_RECEIPT_CONTENT',
      message: 'The image is invalid, too large, or unsupported. Try a clear PNG/JPEG photo.',
    });
  }
}

@Injectable()
export class ReceiptStorage {
  private path(key: string) {
    const root = loadApiEnv().FINANCE_RECEIPT_DIR;
    if (!root || !isAbsolute(root))
      throw new ServiceUnavailableException({
        code: 'RECEIPT_STORAGE_UNAVAILABLE',
        message: 'Private receipt storage must be configured with an absolute path.',
      });
    if (!/^[0-9A-Z]{26}\.jpg$/.test(key))
      throw new BadRequestException({
        code: 'INVALID_STORAGE_KEY',
        message: 'Invalid receipt reference.',
      });
    return { root, file: join(root, key) };
  }
  async put(key: string, buffer: Buffer) {
    const { root, file } = this.path(key);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await writeFile(file, buffer, { flag: 'wx', mode: 0o600 });
  }
  async get(key: string) {
    return readFile(this.path(key).file);
  }
  async remove(key: string) {
    await unlink(this.path(key).file);
  }
}
