import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { getAllTransactions, getTransactionsByCustomerId, getTransactionsByVendorId, } from '../utils/orders.js';
const router = Router();
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        res.json({ success: true, data: { transactions: await getAllTransactions() } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
});
router.get('/customer/:customerId', authMiddleware, async (req, res) => {
    try {
        res.json({ success: true, data: { transactions: await getTransactionsByCustomerId(req.params.customerId) } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
});
router.get('/vendor/:vendorId', authMiddleware, async (req, res) => {
    try {
        res.json({ success: true, data: { transactions: await getTransactionsByVendorId(req.params.vendorId) } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
    }
});
export default router;
