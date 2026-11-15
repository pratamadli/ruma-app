import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { loadApiEnv } from '../../config/env';

@Injectable()
export class TelegramClient {
  async send(
    telegramId: string,
    text: string,
    buttons?: Array<{ text: string; callback_data: string }>,
  ) {
    const token = loadApiEnv().TELEGRAM_BOT_TOKEN;
    if (!token)
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_UNAVAILABLE',
        message: 'Telegram delivery is not configured.',
      });
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          ...(buttons ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
        }),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_DELIVERY_UNCERTAIN',
        message: 'Telegram delivery could not be confirmed.',
      });
    }
    if (!response.ok)
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_DELIVERY_FAILED',
        message: 'Telegram rejected the delivery.',
      });
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_DELIVERY_FAILED',
        message: 'Telegram did not confirm delivery.',
      });
    }
  }
}
