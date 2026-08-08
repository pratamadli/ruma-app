'use client';

import * as Sentry from '@sentry/react';

let initialized = false;

const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|refresh|jwt|invite|reset|amount|balance|account|transfer|currency|description|finance|transaction|budget|spent|remaining|insight|trend|anomaly|recurring|analysis/i;

export function initWebSentry(): void {
  if (initialized || typeof window === 'undefined') return;

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        for (const key of Object.keys(event.request.headers)) {
          if (SENSITIVE_KEY.test(key)) {
            event.request.headers[key] = '[Filtered]';
          }
        }
      }
      return event;
    },
  });

  initialized = true;
}
