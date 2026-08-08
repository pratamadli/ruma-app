import type { NextFunction, Request, Response } from 'express';
import { createId } from '../ids';

export type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0 && incoming.length <= 64
      ? incoming.trim()
      : createId();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
