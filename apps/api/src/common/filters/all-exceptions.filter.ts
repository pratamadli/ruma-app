import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody } from '@ruma/types';
import { captureException } from '../../observability/sentry';
import type { RequestWithId } from '../middleware/request-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const requestId =
      request.requestId ??
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred.';
    let details: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = HttpStatus[status] ?? code;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        message = typeof record.message === 'string' ? record.message : message;
        code = typeof record.code === 'string' ? record.code : (HttpStatus[status] ?? code);
        if (Array.isArray(record.message)) {
          details = record.message;
          message = 'Validation failed.';
          code = 'VALIDATION_ERROR';
        }
      }
    } else {
      this.logger.error(
        JSON.stringify({
          event: 'unhandled_exception',
          requestId,
          path: request.url,
          method: request.method,
        }),
        exception instanceof Error ? exception.stack : undefined,
      );
      captureException(exception, {
        requestId,
        path: request.url,
        method: request.method,
      });
    }

    if (status >= 500 && exception instanceof HttpException) {
      captureException(exception, { requestId, path: request.url, method: request.method, code });
    }

    const payload: ApiErrorBody = {
      error: {
        code,
        message,
        details,
        requestId,
      },
    };

    response.status(status).json(payload);
  }
}
