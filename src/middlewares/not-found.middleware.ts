import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFoundMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};
