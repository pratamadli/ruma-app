import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody } from '@ruma/types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

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
      this.logger.error(exception);
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
