import { AppError } from '../utils/app-error.js';
export const notFoundMiddleware = (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};
