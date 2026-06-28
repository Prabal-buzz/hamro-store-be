import { Router } from 'express';
import healthRouter from './health.route.js';
import authRouter from './auth.route.js';
import usersRouter from './users.route.js';
import ordersRouter from './orders.route.js';
import transactionsRouter from './transactions.route.js';

const apiRouter = Router();

// Mount individual sub-routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/transactions', transactionsRouter);

export default apiRouter;
