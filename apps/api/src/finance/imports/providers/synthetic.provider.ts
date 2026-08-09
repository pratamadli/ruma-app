import type { EmailProvider, ListMessagesResult } from '../types';
import { SYNTHETIC_FIXTURES } from '../fixtures/synthetic-fixtures';

export class SyntheticEmailProvider implements EmailProvider {
  kind = 'SYNTHETIC' as const;

  async listMessages(args: { lookbackDays: number }): Promise<ListMessagesResult> {
    const cutoff = Date.now() - args.lookbackDays * 24 * 60 * 60 * 1000;
    const messages = SYNTHETIC_FIXTURES.filter((m) => m.receivedAt.getTime() >= cutoff);
    return { messages, messageFetchFailures: 0, truncated: false };
  }
}
