import { BadRequestException } from '@nestjs/common';
import { loadApiEnv } from '../../../config/env';
import { fetchWithRetry, ProviderHttpError } from '../http-retry';
import type { EmailProvider, ListMessagesResult, RawEmailMessage } from '../types';

const MAX_PAGES = 5;
const PAGE_SIZE = 50;
const MAX_MESSAGES = 150;

/**
 * Gmail provider — optional. Requires GOOGLE_CLIENT_* env + encrypted OAuth tokens.
 * Domain code never sees Gmail payload shapes beyond RawEmailMessage.
 */
export class GmailEmailProvider implements EmailProvider {
  kind = 'GMAIL' as const;

  static isConfigured(): boolean {
    const env = loadApiEnv();
    return Boolean(
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URL,
    );
  }

  static authUrl(state: string): string {
    const env = loadApiEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_OAUTH_REDIRECT_URL) {
      throw new BadRequestException({
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'Gmail OAuth is not configured on this server.',
      });
    }
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    emailAddress: string;
    scopes: string;
  }> {
    const env = loadApiEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URL) {
      throw new BadRequestException({
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'Gmail OAuth is not configured on this server.',
      });
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetchWithRetry(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL,
            grant_type: 'authorization_code',
          }),
          timeoutMs: 15_000,
        },
        { retries: 1 },
      );
    } catch (error) {
      throw mapProviderError(
        error,
        'GMAIL_OAUTH_FAILED',
        'Could not complete Gmail authorization.',
      );
    }

    if (!tokenRes.ok) {
      throw new BadRequestException({
        code: 'GMAIL_OAUTH_FAILED',
        message: 'Could not complete Gmail authorization. The code may be expired or already used.',
      });
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!tokenJson.access_token) {
      throw new BadRequestException({
        code: 'GMAIL_OAUTH_FAILED',
        message: 'Gmail authorization did not return an access token.',
      });
    }

    const profile = await this.fetchProfile(tokenJson.access_token);

    return {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt:
        typeof tokenJson.expires_in === 'number'
          ? new Date(Date.now() + tokenJson.expires_in * 1000)
          : null,
      emailAddress: profile,
      scopes: tokenJson.scope ?? 'https://www.googleapis.com/auth/gmail.readonly',
    };
  }

  static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date | null;
  }> {
    const env = loadApiEnv();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new BadRequestException({
        code: 'GMAIL_NOT_CONFIGURED',
        message: 'Gmail OAuth is not configured on this server.',
      });
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetchWithRetry(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
          }),
          timeoutMs: 15_000,
        },
        { retries: 1 },
      );
    } catch (error) {
      throw mapProviderError(
        error,
        'GMAIL_AUTH_EXPIRED',
        'Gmail authorization expired. Please reconnect.',
      );
    }

    if (!tokenRes.ok) {
      throw new BadRequestException({
        code: 'GMAIL_AUTH_EXPIRED',
        message: 'Gmail authorization expired. Please reconnect.',
      });
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!tokenJson.access_token) {
      throw new BadRequestException({
        code: 'GMAIL_AUTH_EXPIRED',
        message: 'Gmail authorization expired. Please reconnect.',
      });
    }
    return {
      accessToken: tokenJson.access_token,
      expiresAt:
        typeof tokenJson.expires_in === 'number'
          ? new Date(Date.now() + tokenJson.expires_in * 1000)
          : null,
    };
  }

  /** Best-effort provider-side revoke; local credentials are cleared regardless. */
  static async revokeToken(token: string): Promise<void> {
    try {
      await fetchWithRetry(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        { method: 'POST', timeoutMs: 8_000 },
        { retries: 0 },
      );
    } catch {
      // Local disconnect still proceeds.
    }
  }

  private static async fetchProfile(accessToken: string): Promise<string> {
    let profileRes: Response;
    try {
      profileRes = await fetchWithRetry(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` }, timeoutMs: 15_000 },
        { retries: 1 },
      );
    } catch (error) {
      throw mapProviderError(error, 'GMAIL_PROFILE_FAILED', 'Could not read Gmail profile.');
    }
    if (!profileRes.ok) {
      throw new BadRequestException({
        code: 'GMAIL_PROFILE_FAILED',
        message: 'Could not read Gmail profile.',
      });
    }
    const profile = (await profileRes.json()) as { emailAddress?: string };
    if (!profile.emailAddress) {
      throw new BadRequestException({
        code: 'GMAIL_PROFILE_FAILED',
        message: 'Gmail profile missing email address.',
      });
    }
    return profile.emailAddress;
  }

  async listMessages(args: {
    lookbackDays: number;
    accessToken?: string;
  }): Promise<ListMessagesResult> {
    if (!args.accessToken) {
      throw new BadRequestException({
        code: 'AUTHENTICATION_ERROR',
        message: 'Gmail connection needs to be re-authorized.',
      });
    }

    const after = Math.floor((Date.now() - args.lookbackDays * 86400000) / 1000);
    const q = [
      `after:${after}`,
      '(',
      'from:bca.co.id OR from:bankmandiri.co.id OR from:mandiri OR ',
      'from:gopay OR from:go-jek.com OR from:midtrans ',
      'OR subject:transaction OR subject:pembayaran OR subject:transfer OR subject:transaksi',
      ')',
    ].join('');

    const ids: string[] = [];
    let pageToken: string | undefined;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      listUrl.searchParams.set('q', q);
      listUrl.searchParams.set('maxResults', String(PAGE_SIZE));
      if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

      let listRes: Response;
      try {
        listRes = await fetchWithRetry(
          listUrl,
          { headers: { Authorization: `Bearer ${args.accessToken}` }, timeoutMs: 20_000 },
          { retries: 2 },
        );
      } catch (error) {
        throw mapProviderError(error, 'PROVIDER_ERROR', 'Gmail is temporarily unavailable.');
      }

      if (!listRes.ok) {
        throw new BadRequestException({
          code: 'PROVIDER_ERROR',
          message: 'Gmail is temporarily unavailable.',
        });
      }

      const listJson = (await listRes.json()) as {
        messages?: Array<{ id: string }>;
        nextPageToken?: string;
      };
      for (const m of listJson.messages ?? []) {
        ids.push(m.id);
        if (ids.length >= MAX_MESSAGES) {
          truncated = true;
          break;
        }
      }
      if (truncated || !listJson.nextPageToken) break;
      pageToken = listJson.nextPageToken;
    }

    if (ids.length >= MAX_MESSAGES) truncated = true;

    const out: RawEmailMessage[] = [];
    let messageFetchFailures = 0;

    for (const id of ids.slice(0, MAX_MESSAGES)) {
      try {
        const msgRes = await fetchWithRetry(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${args.accessToken}` }, timeoutMs: 15_000 },
          { retries: 1 },
        );
        if (!msgRes.ok) {
          messageFetchFailures += 1;
          continue;
        }
        const msg = (await msgRes.json()) as {
          id: string;
          internalDate?: string;
          payload?: MimePart;
        };
        const headers = msg.payload?.headers ?? [];
        const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
        const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
        out.push({
          providerMessageId: msg.id,
          from,
          subject,
          textBody: extractPlainText(msg.payload),
          receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
        });
      } catch {
        messageFetchFailures += 1;
      }
    }

    return { messages: out, messageFetchFailures, truncated };
  }
}

type MimePart = {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: MimePart[];
};

function extractPlainText(payload: MimePart | undefined, depth = 0): string {
  if (!payload || depth > 6) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.body?.data && (!payload.parts || payload.parts.length === 0)) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  for (const part of payload.parts ?? []) {
    const nested = extractPlainText(part, depth + 1);
    if (nested) return nested;
  }
  return '';
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function mapProviderError(error: unknown, code: string, message: string): BadRequestException {
  if (error instanceof ProviderHttpError) {
    return new BadRequestException({
      code: error.code === 'AUTHENTICATION_ERROR' ? 'AUTHENTICATION_ERROR' : error.code,
      message: error.message,
    });
  }
  return new BadRequestException({ code, message });
}
