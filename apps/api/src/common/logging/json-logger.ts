import type { LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

/**
 * Machine-readable logs for production. Never put secrets in `message` / `meta`.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const entry: Record<string, unknown> = {
      level: level === 'log' ? 'info' : level,
      message: typeof message === 'string' ? message : safeSerialize(message),
      timestamp: new Date().toISOString(),
    };
    if (context) entry.context = context;
    if (trace) entry.trace = trace;
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
