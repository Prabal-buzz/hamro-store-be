import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const errorMiddleware: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const message = err.message || 'Something went wrong';

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    res.status(statusCode).json({
      status,
      message,
      stack: err.stack,
      error: err,
    });
    return;
  }

  // Production response
  if (err instanceof AppError || err.isOperational) {
    res.status(statusCode).json({
      status,
      message,
    });
    return;
  }

  // Programming or other unknown errors: don't leak details
  console.error('ERROR 💥:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went very wrong!',
  });
};
