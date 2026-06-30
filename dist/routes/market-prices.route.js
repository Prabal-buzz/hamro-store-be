import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getMarketPrices, lookupMarketPrice } from '../utils/market-prices.js';
import { VENDOR_CATEGORIES } from '../types/auth.js';
const router = Router();
/**
 * GET /market-prices
 * Returns all market prices (optionally filtered by ?category=...)
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { category } = req.query;
        if (category && !VENDOR_CATEGORIES.includes(category)) {
            return res.status(400).json({
                success: false,
                message: `Invalid category. Must be one of: ${VENDOR_CATEGORIES.join(', ')}`,
            });
        }
        const prices = await getMarketPrices(category);
        const date = prices[0]?.date ?? new Date().toISOString().slice(0, 10);
        res.json({
            success: true,
            data: {
                date,
                category: category ?? 'all',
                prices,
            },
        });
    }
    catch (error) {
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
router.get('/lookup', authMiddleware, async (req, res) => {
    try {
        const { name, category } = req.query;
        if (!name || !category) {
            return res.status(400).json({ success: false, message: 'name and category query params are required' });
        }
        if (!VENDOR_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, message: `Invalid category` });
        }
        const avgPrice = await lookupMarketPrice(name, category);
        res.json({ success: true, data: { name, category, avgPrice } });
    }
    catch (error) {
        res.status(502).json({ success: false, message: 'Price lookup failed' });
    }
});
export default router;
