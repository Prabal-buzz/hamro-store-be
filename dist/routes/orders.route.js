import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { adminMiddleware } from '../middlewares/auth.middleware.js';
import { getAllOrders, getOrderById, getOrdersByCustomerId, getOrdersByVendorId, createOrder, createOrderItem, updateOrderItemStatus, } from '../utils/orders.js';
const router = Router();
// Validation schemas
const createOrderSchema = z.object({
    meatType: z.string().min(1, "Meat type is required"),
    totalQuantity: z.number().positive("Quantity must be positive"),
    unit: z.string().min(1, "Unit is required"),
});
const createOrderItemSchema = z.object({
    orderId: z.string().min(1, "Order ID is required"),
    vendorId: z.string().min(1, "Vendor ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    pricePerUnit: z.number().positive("Price must be positive"),
});
const updateOrderItemStatusSchema = z.object({
    status: z.enum(["accepted", "rejected", "completed"]),
});
// GET /orders - Get all orders (admin only)
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const orders = getAllOrders();
        res.json({
            success: true,
            data: { orders },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
        });
    }
});
// GET /orders/:id - Get order by ID
router.get('/:id', authMiddleware, (req, res) => {
    try {
        const order = getOrderById(req.params.id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }
        res.json({
            success: true,
            data: { order },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order',
        });
    }
});
// GET /orders/customer/:customerId - Get orders by customer ID
router.get('/customer/:customerId', authMiddleware, (req, res) => {
    try {
        const orders = getOrdersByCustomerId(req.params.customerId);
        res.json({
            success: true,
            data: { orders },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders',
        });
    }
});
// GET /orders/vendor/:vendorId - Get order items by vendor ID
router.get('/vendor/:vendorId', authMiddleware, (req, res) => {
    try {
        const orderItems = getOrdersByVendorId(req.params.vendorId);
        res.json({
            success: true,
            data: { orderItems },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order items',
        });
    }
});
// GET /orders/available - Get all pending orders available for vendors to accept
router.get('/available', authMiddleware, (req, res) => {
    try {
        const allOrders = getAllOrders();
        const availableOrders = allOrders.filter((order) => order.status === "pending" || order.status === "partial");
        res.json({
            success: true,
            data: { orders: availableOrders },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available orders',
        });
    }
});
// POST /orders - Create new order (customer only)
router.post('/', authMiddleware, (req, res) => {
    try {
        const validatedData = createOrderSchema.parse(req.body);
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }
        const newOrder = createOrder({
            customerId: userId,
            meatType: validatedData.meatType,
            totalQuantity: validatedData.totalQuantity,
            unit: validatedData.unit,
        });
        res.status(201).json({
            success: true,
            data: { order: newOrder },
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to create order',
        });
    }
});
// POST /orders/items - Create order item (vendor accepts order)
router.post('/items', authMiddleware, (req, res) => {
    try {
        const validatedData = createOrderItemSchema.parse(req.body);
        const totalPrice = validatedData.quantity * validatedData.pricePerUnit;
        const newOrderItem = createOrderItem({
            ...validatedData,
            totalPrice,
        });
        res.status(201).json({
            success: true,
            data: { orderItem: newOrderItem },
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to create order item',
        });
    }
});
// PUT /orders/items/:id/status - Update order item status (vendor)
router.put('/items/:id/status', authMiddleware, (req, res) => {
    try {
        const validatedData = updateOrderItemStatusSchema.parse(req.body);
        const updatedOrderItem = updateOrderItemStatus(req.params.id, validatedData.status);
        if (!updatedOrderItem) {
            return res.status(404).json({
                success: false,
                message: 'Order item not found',
            });
        }
        res.json({
            success: true,
            data: { orderItem: updatedOrderItem },
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            });
        }
        res.status(500).json({
            success: false,
            message: 'Failed to update order item status',
        });
    }
});
export default router;
