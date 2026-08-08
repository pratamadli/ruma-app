import * as Sentry from '@sentry/node';
import type { ApiEnv } from '@ruma/validation';

let initialized = false;

const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|refresh|jwt|invite|reset|amount|balance|account|transfer|currency|description|finance|transaction|budget|spent|remaining|insight|trend|anomaly|recurring|analysis/i;

export function initSentry(env: ApiEnv): void {
  if (!env.SENTRY_DSN || initialized) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(scrubRecord(context));
    }
    Sentry.captureException(error);
  });
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_KEY.test(key)) {
        event.request.headers[key] = '[Filtered]';
      }
    }
  }
  if (event.request?.cookies) {
    for (const key of Object.keys(event.request.cookies)) {
      event.request.cookies[key] = '[Filtered]';
    }
  }
  if (event.request?.data && typeof event.request.data === 'object') {
    event.request.data = scrubRecord(event.request.data as Record<string, unknown>);
  }
  return event;
}

function scrubRecord(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[Filtered]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scrubRecord(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
