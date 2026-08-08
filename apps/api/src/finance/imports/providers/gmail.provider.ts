import { BadRequestException } from '@nestjs/common';
import { loadApiEnv } from '../../../config/env';
import type { EmailProvider, RawEmailMessage } from '../types';

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

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URL,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      throw new BadRequestException({
        code: 'GMAIL_OAUTH_FAILED',
        message: 'Could not complete Gmail authorization.',
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

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
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

    return {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? null,
      expiresAt:
        typeof tokenJson.expires_in === 'number'
          ? new Date(Date.now() + tokenJson.expires_in * 1000)
          : null,
      emailAddress: profile.emailAddress,
      scopes: tokenJson.scope ?? 'https://www.googleapis.com/auth/gmail.readonly',
    };
  }

  async listMessages(args: {
    lookbackDays: number;
    accessToken?: string;
  }): Promise<RawEmailMessage[]> {
    if (!args.accessToken) {
      throw new BadRequestException({
        code: 'GMAIL_AUTH_REQUIRED',
        message: 'Gmail connection needs to be re-authorized.',
      });
    }

    const after = Math.floor((Date.now() - args.lookbackDays * 86400000) / 1000);
    // Narrow query: transaction-ish subjects from common Indonesian banks/wallets.
    const q = `after:${after} (from:bca.co.id OR from:mandiri OR subject:transaction OR subject:pembayaran OR subject:transfer)`;
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', q);
    listUrl.searchParams.set('maxResults', '50');

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    });
    if (listRes.status === 401 || listRes.status === 403) {
      throw new BadRequestException({
        code: 'GMAIL_AUTH_EXPIRED',
        message: 'Gmail authorization expired. Please reconnect.',
      });
    }
    if (!listRes.ok) {
      throw new BadRequestException({
        code: 'GMAIL_PROVIDER_ERROR',
        message: 'Gmail is temporarily unavailable.',
      });
    }

    const listJson = (await listRes.json()) as { messages?: Array<{ id: string }> };
    const ids = (listJson.messages ?? []).map((m) => m.id).slice(0, 50);
    const out: RawEmailMessage[] = [];

    for (const id of ids) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${args.accessToken}` } },
      );
      if (!msgRes.ok) continue;
      const msg = (await msgRes.json()) as {
        id: string;
        internalDate?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
          body?: { data?: string };
          parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
        };
      };
      const headers = msg.payload?.headers ?? [];
      const from = headers.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
      const subject = headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
      const textBody = extractPlainText(msg.payload);
      out.push({
        providerMessageId: msg.id,
        from,
        subject,
        textBody,
        receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
      });
    }

    return out;
  }
}

function extractPlainText(
  payload:
    | {
        body?: { data?: string };
        parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
      }
    | undefined,
): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  for (const part of payload.parts ?? []) {
    if (part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  return '';
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}
