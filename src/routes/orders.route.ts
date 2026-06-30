import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import {
  getAllOrders,
  getAllOrderItems,
  getOrderById,
  getOrderItemById,
  getOrderItemsByOrderId,
  getOrdersByCustomerId,
  getOrdersByVendorId,
  createOrder,
  createOrderItem,
  updateOrderItemStatus,
  increaseOrderItemQuantity,
  createNotification,
  getNotificationsByVendorId,
  getNotificationById,
  updateNotificationStatus,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../utils/orders.js';
import { VendorCategory } from '../types/orders.js';
import { VENDOR_CATEGORIES } from '../types/auth.js';
import { prisma } from '../lib/prisma.js';
import { enumToCategory } from '../utils/users.js';

const router = Router();

// ─── Role middlewares ─────────────────────────────────────────────────────────

const vendorMiddleware = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Access denied. Vendor only.' });
  }
  next();
};

const customerMiddleware = (req: Request, res: Response, next: any) => {
  if ((req as any).user?.role !== 'customer') {
    return res.status(403).json({ success: false, message: 'Access denied. Customer only.' });
  }
  next();
};

// ─── Validation schemas ───────────────────────────────────────────────────────

const createOrderSchema = z.object({
  productType: z.enum(VENDOR_CATEGORIES as [VendorCategory, ...VendorCategory[]]),
  productName: z.string().min(1),
  totalQuantity: z.number().positive(),
  unit: z.string().min(1),
});

const createOrderItemSchema = z.object({
  orderId: z.string().min(1),
  vendorId: z.string().min(1),
  quantity: z.number().positive(),
  pricePerUnit: z.number().positive(),
});

const updateOrderItemStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected', 'completed']),
});

// ─── GET routes (specific paths BEFORE /:id) ─────────────────────────────────

router.get('/', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    res.json({ success: true, data: { orders: await getAllOrders() } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch orders' }); }
});

router.get('/admin/enriched', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [allOrders, allItems, allUsers] = await Promise.all([
      getAllOrders(),
      getAllOrderItems(),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    ]);

    const enriched = allOrders.map((order: any) => {
      const customer = allUsers.find((u: any) => u.id === order.customerId);
      const items = allItems
        .filter((oi: any) => oi.orderId === order.id)
        .map((oi: any) => {
          const vendor = allUsers.find((u: any) => u.id === oi.vendorId);
          return { ...oi, vendorName: vendor?.name ?? oi.vendorId, vendorEmail: vendor?.email ?? '' };
        });
      return {
        ...order,
        customerName: customer?.name ?? order.customerId,
        customerEmail: customer?.email ?? '',
        items,
      };
    });
    res.json({ success: true, data: { orders: enriched } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch enriched orders' }); }
});

router.get('/me', authMiddleware, customerMiddleware, async (req, res) => {
  try {
    const customerId = (req as any).user?.id as string;
    const [orders, allItems] = await Promise.all([
      getOrdersByCustomerId(customerId),
      getAllOrderItems(),
    ]);
    const enriched = orders.map((order: any) => ({
      ...order,
      items: allItems.filter((oi: any) => oi.orderId === order.id),
    }));
    res.json({ success: true, data: { orders: enriched } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch your orders' }); }
});

router.get('/me/commitments', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const vendorId = (req as any).user?.id as string;
    const items = await getOrdersByVendorId(vendorId);
    const enriched = await Promise.all(items.map(async (item: any) => {
      const order = await getOrderById(item.orderId);
      return {
        ...item,
        productName: order?.productName ?? 'Unknown',
        productType: order?.productType ? enumToCategory(order.productType as string) : 'Unknown',
        unit: order?.unit ?? '',
        orderStatus: order?.status ?? 'unknown',
        totalQuantity: order?.totalQuantity ?? 0,
        fulfilledQuantity: order?.fulfilledQuantity ?? 0,
      };
    }));
    res.json({ success: true, data: { commitments: enriched } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch your commitments' }); }
});

router.get('/available', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const vendorId = (req as any).user?.id as string;
    const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
    if (!vendor?.category) {
      return res.status(403).json({ success: false, message: 'Vendor has no category assigned.' });
    }
    const orders = await prisma.order.findMany({
      where: { status: { in: ['pending', 'partial'] }, productType: vendor.category },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { orders } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch available orders' }); }
});

router.get('/notifications', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    res.json({ success: true, data: { notifications: await getNotificationsByVendorId(userId) } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch notifications' }); }
});

router.get('/notifications/:id', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const notification = await getNotificationById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: { notification } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch notification' }); }
});

router.get('/customer/:customerId', authMiddleware, async (req, res) => {
  try {
    res.json({ success: true, data: { orders: await getOrdersByCustomerId(req.params.customerId) } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch orders' }); }
});

router.get('/vendor/:vendorId', authMiddleware, async (req, res) => {
  try {
    res.json({ success: true, data: { orderItems: await getOrdersByVendorId(req.params.vendorId) } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch order items' }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: { order } });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch order' }); }
});

// ─── Mutations ────────────────────────────────────────────────────────────────

router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const userId = (req as any).user?.id as string;

    const newOrder = await createOrder({
      customerId: userId,
      productType: data.productType,
      productName: data.productName,
      totalQuantity: data.totalQuantity,
      unit: data.unit,
    });

    // Notify category-matching vendors
    const vendors = await prisma.user.findMany({
      where: { role: 'vendor', category: newOrder.productType },
    });
    await Promise.all(vendors.map((v: any) =>
      createNotification({
        vendorId: v.id,
        orderId: newOrder.id,
        customerId: userId,
        productName: newOrder.productName,
        productType: enumToCategory(newOrder.productType as string) as VendorCategory,
        totalQuantity: newOrder.totalQuantity,
        unit: newOrder.unit,
        status: 'pending',
      })
    ));

    res.status(201).json({ success: true, data: { order: newOrder } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

router.post('/items', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const data = createOrderItemSchema.parse(req.body);
    const vendorId = (req as any).user?.id as string;

    const order = await getOrderById(data.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This order has already been fully fulfilled.' });
    }

    const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.category !== order.productType) {
      return res.status(403).json({ success: false, message: `Only vendors in the "${enumToCategory(order.productType as string)}" category can accept this order.` });
    }

    const existing = await prisma.orderItem.findFirst({
      where: { orderId: order.id, vendorId, status: { not: 'rejected' } },
    });
    if (existing) return res.status(400).json({ success: false, message: 'You already have an active commitment for this order.' });

    const remaining = order.totalQuantity - order.fulfilledQuantity;
    if (data.quantity > remaining) {
      return res.status(400).json({ success: false, message: `You can supply at most ${remaining} ${order.unit} for this order.` });
    }

    const newItem = await createOrderItem({
      orderId: data.orderId,
      vendorId,
      quantity: data.quantity,
      pricePerUnit: data.pricePerUnit,
      totalPrice: data.quantity * data.pricePerUnit,
    });

    res.status(201).json({ success: true, data: { orderItem: newItem } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    res.status(500).json({ success: false, message: 'Failed to create order item' });
  }
});

router.put('/items/:id/quantity', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { additionalQuantity } = z.object({ additionalQuantity: z.number().positive() }).parse(req.body);
    const vendorId = (req as any).user?.id as string;
    const result = await increaseOrderItemQuantity(req.params.id, additionalQuantity, vendorId);
    if (!result.success) return res.status(400).json({ success: false, message: result.message });
    res.json({ success: true, data: { orderItem: result.orderItem } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    res.status(500).json({ success: false, message: 'Failed to increase quantity' });
  }
});

router.put('/items/:id/status', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { status } = updateOrderItemStatusSchema.parse(req.body);
    const vendorId = (req as any).user?.id as string;

    const orderItem = await getOrderItemById(req.params.id);
    if (!orderItem) return res.status(404).json({ success: false, message: 'Order item not found' });
    if (orderItem.vendorId !== vendorId) return res.status(403).json({ success: false, message: 'This order item does not belong to you.' });

    const updated = await updateOrderItemStatus(req.params.id, status);
    res.json({ success: true, data: { orderItem: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    res.status(500).json({ success: false, message: 'Failed to update order item status' });
  }
});

router.put('/notifications/read-all', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    res.json({ success: true, data: { notifications: await markAllNotificationsAsRead(userId) } });
  } catch { res.status(500).json({ success: false, message: 'Failed to mark all as read' }); }
});

router.put('/notifications/:id/status', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const { status } = updateOrderItemStatusSchema.parse(req.body);
    const vendorId = (req as any).user?.id as string;
    const notification = await getNotificationById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (notification.vendorId !== vendorId) return res.status(403).json({ success: false, message: 'This notification is not assigned to you.' });
    const updated = await updateNotificationStatus(req.params.id, status);
    res.json({ success: true, data: { notification: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
    res.status(500).json({ success: false, message: 'Failed to update notification status' });
  }
});

router.put('/notifications/:id/read', authMiddleware, vendorMiddleware, async (req, res) => {
  try {
    const updated = await markNotificationAsRead(req.params.id);
    if (!updated) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: { notification: updated } });
  } catch { res.status(500).json({ success: false, message: 'Failed to mark as read' }); }
});

export default router;
