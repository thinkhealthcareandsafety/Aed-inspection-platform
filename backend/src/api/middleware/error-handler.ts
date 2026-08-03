import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
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
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

export function createError(message: string, statusCode: number, code?: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
