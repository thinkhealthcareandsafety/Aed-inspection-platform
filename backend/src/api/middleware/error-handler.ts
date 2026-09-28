import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  /** True when retrying the exact same request stands a real chance of succeeding
   *  (a transient upstream blip) — lets clients auto-retry instead of just failing. */
  retryable?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // A request that failed validation is the caller's mistake, not ours. It
  // was being reported as a 500 with the raw Zod error array as the message,
  // which both misled clients into retrying and leaked the schema's shape.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join('.');
    res.status(400).json({
      error: {
        message: field ? `${field}: ${first.message}` : (first?.message ?? 'Invalid request'),
        code: 'VALIDATION_ERROR',
        retryable: false,
      },
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal Server Error';

  logger.error('Unhandled error', {
    method: req.method,
    url: req.url,
    statusCode,
    message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: {
      message,
      code: err.code ?? 'INTERNAL_ERROR',
      retryable: err.retryable ?? false,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

export function createError(
  message: string,
  statusCode: number,
  code?: string,
  retryable = false,
): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  err.retryable = retryable;
  return err;
}
