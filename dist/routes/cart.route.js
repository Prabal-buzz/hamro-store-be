import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart } from '../utils/cart.js';
import { createOrder, createNotification } from '../utils/orders.js';
import { prisma } from '../lib/prisma.js';
import { enumToCategory } from '../utils/users.js';
import { VENDOR_CATEGORIES } from '../types/auth.js';
const router = Router();
const addToCartSchema = z.object({
    productName: z.string().min(1, 'Product name is required'),
    productType: z.enum(VENDOR_CATEGORIES, {
        errorMap: () => ({ message: `productType must be one of: ${VENDOR_CATEGORIES.join(', ')}` }),
    }),
    unit: z.string().min(1, 'Unit is required'),
    quantity: z.number().positive('Quantity must be positive'),
    pricePerUnit: z.number().positive('Price must be positive'),
    imageUrl: z.string().optional(),
});
const updateCartItemSchema = z.object({
    quantity: z.number().positive('Quantity must be positive'),
});
router.get('/', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        const items = await getCart(customerId);
        const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
        res.json({ success: true, data: { items, subtotal, count: items.length } });
    }
    catch (err) {
        console.error('GET /cart error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch cart' });
    }
});
router.post('/items', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        const input = addToCartSchema.parse(req.body);
        const item = await addToCart(customerId, input);
        res.status(201).json({ success: true, data: { item } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, message: 'Validation error', errors: err.errors });
        console.error('POST /cart/items error:', err);
        res.status(500).json({ success: false, message: 'Failed to add item to cart' });
    }
});
router.put('/items/:id', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        const { quantity } = updateCartItemSchema.parse(req.body);
        const item = await updateCartItem(customerId, req.params.id, quantity);
        if (!item)
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        res.json({ success: true, data: { item } });
    }
    catch (err) {
        if (err instanceof z.ZodError)
            return res.status(400).json({ success: false, message: 'Validation error', errors: err.errors });
        res.status(500).json({ success: false, message: 'Failed to update cart item' });
    }
});
router.delete('/items/:id', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        const removed = await removeCartItem(customerId, req.params.id);
        if (!removed)
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        res.json({ success: true, message: 'Item removed from cart' });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to remove cart item' });
    }
});
router.delete('/', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        await clearCart(customerId);
        res.json({ success: true, message: 'Cart cleared' });
    }
    catch {
        res.status(500).json({ success: false, message: 'Failed to clear cart' });
    }
});
router.post('/checkout', authMiddleware, async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId)
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        const items = await getCart(customerId);
        if (items.length === 0)
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        const createdOrders = await Promise.all(items.map(async (item) => {
            const order = await createOrder({
                customerId,
                productType: enumToCategory(item.productType),
                productName: item.productName,
                totalQuantity: item.quantity,
                unit: item.unit,
            });
            // Notify category-matching vendors
            const vendors = await prisma.user.findMany({
                where: { role: 'vendor', category: order.productType },
            });
            await Promise.all(vendors.map((v) => createNotification({
                vendorId: v.id,
                orderId: order.id,
                customerId,
                productName: order.productName,
                productType: enumToCategory(order.productType),
                totalQuantity: order.totalQuantity,
                unit: order.unit,
                status: 'pending',
            })));
            return order;
        }));
        await clearCart(customerId);
        res.status(201).json({
            success: true,
            data: { orders: createdOrders, count: createdOrders.length },
            message: `${createdOrders.length} order(s) placed successfully`,
        });
    }
    catch (err) {
        console.error('Checkout error:', err);
        res.status(500).json({ success: false, message: 'Checkout failed' });
    }
});
export default router;
