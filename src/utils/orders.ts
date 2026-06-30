import { prisma } from '../lib/prisma.js';
import { categoryToEnum } from './users.js';
import { addOrUpdateVendorProduct } from './products.js';
import { VendorCategory } from '../types/auth.js';

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getAllOrders() {
  return prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({ where: { id } });
}

export async function getOrdersByCustomerId(customerId: string) {
  return prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
}

export async function createOrder(data: {
  customerId: string;
  productType: VendorCategory;
  productName: string;
  totalQuantity: number;
  unit: string;
}) {
  return prisma.order.create({
    data: {
      customerId: data.customerId,
      productType: categoryToEnum(data.productType),
      productName: data.productName,
      totalQuantity: data.totalQuantity,
      unit: data.unit,
      status: 'pending',
      fulfilledQuantity: 0,
    },
  });
}

// ─── Order Items ──────────────────────────────────────────────────────────────

export async function getAllOrderItems() {
  return prisma.orderItem.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getOrderItemById(id: string) {
  return prisma.orderItem.findUnique({ where: { id } });
}

export async function getOrderItemsByOrderId(orderId: string) {
  return prisma.orderItem.findMany({ where: { orderId } });
}

export async function getOrdersByVendorId(vendorId: string) {
  return prisma.orderItem.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
}

export async function createOrderItem(data: {
  orderId: string;
  vendorId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}) {
  // Run in a transaction: create item + update order fulfilled qty + update product inventory
  return prisma.$transaction(async (tx: any) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: data.orderId } });

    const newItem = await tx.orderItem.create({
      data: {
        orderId: data.orderId,
        vendorId: data.vendorId,
        quantity: data.quantity,
        pricePerUnit: data.pricePerUnit,
        totalPrice: data.totalPrice,
        status: 'accepted',
      },
    });

    // Recompute fulfilledQuantity from all accepted items
    const accepted = await tx.orderItem.aggregate({
      where: { orderId: data.orderId, status: 'accepted' },
      _sum: { quantity: true },
    });
    const fulfilled = accepted._sum.quantity ?? 0;
    const newStatus =
      fulfilled >= order.totalQuantity ? 'completed'
      : fulfilled > 0 ? 'partial'
      : 'pending';

    await tx.order.update({
      where: { id: data.orderId },
      data: { fulfilledQuantity: fulfilled, status: newStatus },
    });

    return newItem;
  }).then(async (newItem: any) => {
    // Update vendor product inventory outside the transaction (non-critical)
    const order = await prisma.order.findUnique({ where: { id: data.orderId } });
    if (order) {
      await addOrUpdateVendorProduct({
        vendorId: data.vendorId,
        productName: order.productName,
        productType: order.productType as unknown as VendorCategory,
        unit: order.unit,
        quantity: data.quantity,
        pricePerUnit: data.pricePerUnit,
      });
    }
    return newItem;
  });
}

export async function updateOrderItemStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'completed'
) {
  return prisma.$transaction(async (tx: any) => {
    const item = await tx.orderItem.update({
      where: { id },
      data: { status },
    });

    // Recompute order fulfilled qty
    const accepted = await tx.orderItem.aggregate({
      where: { orderId: item.orderId, status: 'accepted' },
      _sum: { quantity: true },
    });
    const fulfilled = accepted._sum.quantity ?? 0;

    const order = await tx.order.findUniqueOrThrow({ where: { id: item.orderId } });
    const newStatus =
      fulfilled >= order.totalQuantity ? 'completed'
      : fulfilled > 0 ? 'partial'
      : 'pending';

    await tx.order.update({
      where: { id: item.orderId },
      data: { fulfilledQuantity: fulfilled, status: newStatus },
    });

    // Create transaction record on completion
    if (status === 'completed') {
      await tx.transaction.create({
        data: {
          orderItemId: item.id,
          orderId: item.orderId,
          customerId: order.customerId,
          vendorId: item.vendorId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    }

    return item;
  });
}

export async function increaseOrderItemQuantity(
  id: string,
  additionalQuantity: number,
  requestingVendorId: string
): Promise<{ success: true; orderItem: any } | { success: false; message: string }> {
  const orderItem = await prisma.orderItem.findUnique({ where: { id } });
  if (!orderItem) return { success: false, message: 'Order item not found' };
  if (orderItem.vendorId !== requestingVendorId) {
    return { success: false, message: 'This order item does not belong to you.' };
  }
  if (orderItem.status === 'rejected') {
    return { success: false, message: 'Cannot increase quantity on a cancelled commitment.' };
  }

  const order = await prisma.order.findUnique({ where: { id: orderItem.orderId } });
  if (!order) return { success: false, message: 'Associated order not found' };
  if (order.status === 'completed') {
    return { success: false, message: 'This order is already fully fulfilled.' };
  }

  const remaining = order.totalQuantity - order.fulfilledQuantity;
  if (additionalQuantity > remaining) {
    return {
      success: false,
      message: `You can add at most ${remaining} ${order.unit} more (remaining unfulfilled quantity).`,
    };
  }

  const updated = await prisma.$transaction(async (tx: any) => {
    const newQty = orderItem.quantity + additionalQuantity;
    const item = await tx.orderItem.update({
      where: { id },
      data: {
        quantity: newQty,
        totalPrice: newQty * orderItem.pricePerUnit,
      },
    });

    const accepted = await tx.orderItem.aggregate({
      where: { orderId: order.id, status: 'accepted' },
      _sum: { quantity: true },
    });
    const fulfilled = accepted._sum.quantity ?? 0;
    const newStatus =
      fulfilled >= order.totalQuantity ? 'completed'
      : fulfilled > 0 ? 'partial'
      : 'pending';

    await tx.order.update({
      where: { id: order.id },
      data: { fulfilledQuantity: fulfilled, status: newStatus },
    });

    return item;
  });

  // Update product inventory
  await addOrUpdateVendorProduct({
    vendorId: requestingVendorId,
    productName: order.productName,
    productType: order.productType as unknown as VendorCategory,
    unit: order.unit,
    quantity: additionalQuantity,
    pricePerUnit: orderItem.pricePerUnit,
  });

  return { success: true, orderItem: updated };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getAllTransactions() {
  return prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getTransactionsByCustomerId(customerId: string) {
  return prisma.transaction.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
}

export async function getTransactionsByVendorId(vendorId: string) {
  return prisma.transaction.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotificationsByVendorId(vendorId: string) {
  return prisma.notification.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
}

export async function getNotificationById(id: string) {
  return prisma.notification.findUnique({ where: { id } });
}

export async function createNotification(data: {
  vendorId: string;
  orderId: string;
  customerId: string;
  productName: string;
  productType: VendorCategory;
  totalQuantity: number;
  unit: string;
  status: 'pending';
}) {
  return prisma.notification.create({
    data: {
      vendorId: data.vendorId,
      orderId: data.orderId,
      customerId: data.customerId,
      productName: data.productName,
      productType: categoryToEnum(data.productType),
      totalQuantity: data.totalQuantity,
      unit: data.unit,
      status: 'pending',
    },
  });
}

export async function updateNotificationStatus(
  id: string,
  status: 'accepted' | 'rejected' | 'completed'
) {
  return prisma.notification.update({ where: { id }, data: { status } });
}

export async function markNotificationAsRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllNotificationsAsRead(vendorId: string) {
  await prisma.notification.updateMany({ where: { vendorId }, data: { read: true } });
  return prisma.notification.findMany({ where: { vendorId } });
}
