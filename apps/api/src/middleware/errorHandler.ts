import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@academy-library/contracts';
import { AppError } from '../errors/AppError.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId =
    typeof req.id === 'string' ? req.id : typeof req.id === 'number' ? String(req.id) : undefined;

  if (err instanceof ZodError) {
    const body: ApiErrorResponse = {
      error: {
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        requestId,
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    }
    const body: ApiErrorResponse = {
      error: {
        message: err.message,
        code: err.code,
        requestId,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  const body: ApiErrorResponse = {
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId,
    },
  };
  res.status(500).json(body);
}
