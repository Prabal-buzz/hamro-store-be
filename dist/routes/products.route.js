import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { getProductsByVendorId, getAllVendorProducts } from '../utils/products.js';
import { prisma } from '../lib/prisma.js';
const router = Router();
const vendorMiddleware = (req, res, next) => {
    if (req.user?.role !== 'vendor') {
        return res.status(403).json({ success: false, message: 'Access denied. Vendor only.' });
    }
    next();
};
router.get('/me', authMiddleware, vendorMiddleware, async (req, res) => {
    try {
        const vendorId = req.user?.id;
        res.json({ success: true, data: { products: await getProductsByVendorId(vendorId) } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});
router.get('/', authMiddleware, adminMiddleware, async (_req, res) => {
    try {
        const [products, users] = await Promise.all([
            getAllVendorProducts(),
            prisma.user.findMany({ select: { id: true, name: true, email: true } }),
        ]);
        const enriched = products.map((p) => {
            const vendor = users.find((u) => u.id === p.vendorId);
            return { ...p, vendorName: vendor?.name ?? p.vendorId, vendorEmail: vendor?.email ?? '' };
        });
        res.json({ success: true, data: { products: enriched } });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});
export default router;
