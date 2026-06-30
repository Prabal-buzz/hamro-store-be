import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { getProductsByVendorId, getAllVendorProducts } from '../utils/products.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const vendorMiddleware = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Access denied. Vendor only.' });
  }
  next();
};

router.get('/me', authMiddleware, vendorMiddleware, async (req: Request, res: Response) => {
  try {
    const vendorId = (req as any).user?.id as string;
    res.json({ success: true, data: { products: await getProductsByVendorId(vendorId) } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch products' }); }
});

router.get('/', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const [products, users] = await Promise.all([
      getAllVendorProducts(),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    ]);
    const enriched = products.map((p: any) => {
      const vendor = users.find((u: any) => u.id === p.vendorId);
      return { ...p, vendorName: vendor?.name ?? p.vendorId, vendorEmail: vendor?.email ?? '' };
    });
    res.json({ success: true, data: { products: enriched } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch products' }); }
});

export default router;
