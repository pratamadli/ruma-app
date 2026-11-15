import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { loadApiEnv } from '../../config/env';

export function sameSecret(actual: string | undefined, expected: string | undefined) {
  return Boolean(
    actual &&
    expected &&
    timingSafeEqual(
      createHash('sha256').update(actual).digest(),
      createHash('sha256').update(expected).digest(),
    ),
  );
}

@Injectable()
export class HermesGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (
      !sameSecret(
        request.headers.authorization,
        loadApiEnv().HERMES_SERVICE_TOKEN
          ? `Bearer ${loadApiEnv().HERMES_SERVICE_TOKEN}`
          : undefined,
      )
    ) {
      throw new UnauthorizedException({
        code: 'INTEGRATION_UNAUTHORIZED',
        message: 'Integration authentication required.',
      });
    }
    return true;
  }
}

@Injectable()
export class TelegramGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (
      !sameSecret(
        request.headers['x-telegram-bot-api-secret-token'],
        loadApiEnv().TELEGRAM_WEBHOOK_SECRET,
      )
    ) {
      throw new UnauthorizedException({
        code: 'INTEGRATION_UNAUTHORIZED',
        message: 'Integration authentication required.',
      });
    }
    return true;
  }
}
