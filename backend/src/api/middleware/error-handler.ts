import { Request, Response, NextFunction } from 'express';
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
