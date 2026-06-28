import { Router } from 'express';
import healthRouter from './health.route.js';
import authRouter from './auth.route.js';
import usersRouter from './users.route.js';

const apiRouter = Router();

// Mount individual sub-routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);

export default apiRouter;
