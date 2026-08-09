/** Bounded fetch with timeout + retries for transient provider failures. */

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'AUTHENTICATION_ERROR' | 'RATE_LIMITED' | 'PROVIDER_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  opts: { retries?: number; label?: string } = {},
): Promise<Response> {
  const retries = opts.retries ?? 2;
  const timeoutMs = init.timeoutMs ?? 15_000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        throw new ProviderHttpError(
          res.status,
          'AUTHENTICATION_ERROR',
          'Gmail authorization expired. Please reconnect.',
        );
      }

      if (res.status === 429) {
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * 2 ** attempt;
          await sleep(Math.min(waitMs, 5_000));
          continue;
        }
        throw new ProviderHttpError(
          429,
          'RATE_LIMITED',
          'Gmail rate limit reached. Try again in a few minutes.',
        );
      }

      if (RETRYABLE.has(res.status) && attempt < retries) {
        await sleep(300 * 2 ** attempt);
        continue;
      }

      if (!res.ok && RETRYABLE.has(res.status)) {
        throw new ProviderHttpError(
          res.status,
          'PROVIDER_ERROR',
          'Gmail is temporarily unavailable.',
        );
      }

      return res;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (error instanceof ProviderHttpError) throw error;
      if (attempt < retries) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new ProviderHttpError(0, 'PROVIDER_ERROR', 'Gmail is temporarily unavailable.');
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderHttpError(0, 'PROVIDER_ERROR', 'Gmail is temporarily unavailable.');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
