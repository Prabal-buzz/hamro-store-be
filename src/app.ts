import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { setupSwagger } from './config/swagger.js';

const app: Express = express();

// 1. Global Middlewares
// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// HTTP request logging
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 2. Routes
setupSwagger(app);
app.use('/api/v1', apiRouter);

// 3. Error Handling for unhandled routes
app.use(notFoundMiddleware);

// 4. Global Error Handler Middleware
app.use(errorMiddleware);

export default app;
