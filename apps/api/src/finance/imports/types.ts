export type RawEmailMessage = {
  providerMessageId: string;
  from: string;
  subject: string;
  /** Plain-text body only (never HTML persistence). */
  textBody: string;
  receivedAt: Date;
};

export type ParsedEmailCandidate = {
  parserProvider: string;
  transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER' | null;
  amountMinor: bigint | null;
  currency: string | null;
  transactionDate: string | null; // YYYY-MM-DD
  description: string | null;
  merchant: string | null;
  reference: string | null;
  accountHint: string | null;
  categoryHint: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  parseError: string | null;
};

export type EmailProvider = {
  kind: 'SYNTHETIC' | 'GMAIL';
  listMessages(args: { lookbackDays: number; accessToken?: string }): Promise<RawEmailMessage[]>;
};
