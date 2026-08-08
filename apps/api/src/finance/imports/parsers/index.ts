import type { ParsedEmailCandidate, RawEmailMessage } from '../types';
import { parseBcaEmail } from './bca.parser';
import { parseSyntheticBankEmail } from './synthetic-bank.parser';

const parsers = [parseSyntheticBankEmail, parseBcaEmail];

/** First matching parser wins. Returns null if no financial email. */
export function parseTransactionEmail(message: RawEmailMessage): ParsedEmailCandidate | null {
  for (const parse of parsers) {
    const result = parse(message);
    if (result) return result;
  }
  return null;
}
