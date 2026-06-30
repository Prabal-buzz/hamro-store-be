import { Router } from 'express';
import healthRouter from './health.route.js';
import authRouter from './auth.route.js';
import usersRouter from './users.route.js';
import ordersRouter from './orders.route.js';
import transactionsRouter from './transactions.route.js';
import marketPricesRouter from './market-prices.route.js';
import cartRouter from './cart.route.js';
import productsRouter from './products.route.js';

const apiRouter = Router();

// Mount individual sub-routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/market-prices', marketPricesRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/products', productsRouter);

export default apiRouter;
