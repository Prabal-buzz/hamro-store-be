import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminMiddleware } from '../middlewares/auth.middleware.js';
import {
  getAllTransactions,
  getTransactionsByCustomerId,
  getTransactionsByVendorId,
} from '../utils/orders.js';

const router = Router();

// GET /transactions - Get all transactions (admin only)
router.get('/', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  try {
    const transactions = getAllTransactions();
    res.json({
      success: true,
      data: { transactions },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
    });
  }
});

// GET /transactions/customer/:customerId - Get transactions by customer ID
router.get('/customer/:customerId', authMiddleware, (req: Request, res: Response) => {
  try {
    const transactions = getTransactionsByCustomerId(req.params.customerId);
    res.json({
      success: true,
      data: { transactions },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
    });
  }
});

// GET /transactions/vendor/:vendorId - Get transactions by vendor ID
router.get('/vendor/:vendorId', authMiddleware, (req: Request, res: Response) => {
  try {
    const transactions = getTransactionsByVendorId(req.params.vendorId);
    res.json({
      success: true,
      data: { transactions },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
    });
  }
});

export default router;
