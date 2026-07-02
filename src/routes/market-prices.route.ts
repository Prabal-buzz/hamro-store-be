import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getMarketPrices, lookupMarketPrice } from '../utils/market-prices.js';
import { VENDOR_CATEGORIES, VendorCategory } from '../types/auth.js';
import { getOverrideMap } from '../utils/price-overrides.js';

const router = Router();

/**
 * GET /market-prices
 * Returns all market prices (optionally filtered by ?category=...)
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category } = req.query as { category?: string };

    if (category && !VENDOR_CATEGORIES.includes(category as VendorCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VENDOR_CATEGORIES.join(', ')}`,
      });
    }

    const prices = await getMarketPrices(category as VendorCategory | undefined);
    const date = prices[0]?.date ?? new Date().toISOString().slice(0, 10);

    // Apply admin price overrides from JSON file store
    const overrideMap = getOverrideMap();
    const finalPrices = prices.map((p) => {
      const override = overrideMap.get(p.name.toLowerCase());
      return override !== undefined ? { ...p, avgPrice: override, adminOverride: true } : p;
    });

    res.json({
      success: true,
      data: {
        date,
        category: category ?? 'all',
        prices: finalPrices,
      },
    });
  } catch (error) {
    console.error('Market prices error:', error);
    res.status(502).json({
      success: false,
      message: 'Failed to fetch market prices. Kalimati API may be unavailable.',
    });
  }
});

/**
 * GET /market-prices/lookup?name=Tomatoes&category=Vegetables+and+Fruits
 * Returns the average market price for a specific product
 */
router.get('/lookup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, category } = req.query as { name?: string; category?: string };

    if (!name || !category) {
      return res.status(400).json({ success: false, message: 'name and category query params are required' });
    }
    if (!VENDOR_CATEGORIES.includes(category as VendorCategory)) {
      return res.status(400).json({ success: false, message: `Invalid category` });
    }

    const kalimatiPrice = await lookupMarketPrice(name, category as VendorCategory);
    const overrideMap = getOverrideMap();
    const avgPrice = overrideMap.get((name as string).toLowerCase()) ?? kalimatiPrice;
    res.json({ success: true, data: { name, category, avgPrice } });
  } catch (error) {
    res.status(502).json({ success: false, message: 'Price lookup failed' });
  }
});

export default router;
