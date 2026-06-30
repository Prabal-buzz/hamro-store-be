import { prisma } from '../lib/prisma.js';
import { categoryToEnum, enumToCategory } from './users.js';
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

// ─── Grouped views ────────────────────────────────────────────────────────────

/** Available orders grouped by product name — vendor sees one card per product. */
export async function getGroupedAvailableOrders(vendorId: string) {
  const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
  if (!vendor?.category) return [];

  const orders = await prisma.order.findMany({
    where: { status: { in: ['pending', 'partial'] }, productType: vendor.category },
    orderBy: { createdAt: 'asc' },
  });

  // Orders this vendor has already committed to (non-rejected)
  const vendorItems = await prisma.orderItem.findMany({
    where: { vendorId, status: { not: 'rejected' } },
    select: { orderId: true },
  });
  const committedIds = new Set(vendorItems.map((i: any) => i.orderId));

  const grouped: Record<string, {
    productName: string; productType: string; unit: string;
    totalDemand: number; remainingDemand: number; customerCount: number; orderIds: string[];
  }> = {};

  for (const order of orders) {
    const remaining = order.totalQuantity - order.fulfilledQuantity;
    if (remaining <= 0 || committedIds.has(order.id)) continue;
    const key = order.productName;
    if (!grouped[key]) {
      grouped[key] = {
        productName: order.productName,
        productType: enumToCategory(order.productType as string),
        unit: order.unit,
        totalDemand: 0, remainingDemand: 0, customerCount: 0, orderIds: [],
      };
    }
    grouped[key].totalDemand += order.totalQuantity;
    grouped[key].remainingDemand += remaining;
    grouped[key].customerCount++;
    grouped[key].orderIds.push(order.id);
  }
  return Object.values(grouped);
}

/** Vendor commitments grouped by product name. */
export async function getGroupedCommitments(vendorId: string) {
  const items = await prisma.orderItem.findMany({
    where: { vendorId, status: { not: 'rejected' } },
    orderBy: { createdAt: 'desc' },
  });

  const grouped: Record<string, {
    productName: string; productType: string; unit: string;
    totalCommitted: number; totalRevenue: number; remainingDemand: number;
    status: string; itemCount: number; pricePerUnit: number;
  }> = {};

  for (const item of items) {
    const order = await prisma.order.findUnique({ where: { id: item.orderId } });
    if (!order) continue;
    const key = order.productName;
    if (!grouped[key]) {
      grouped[key] = {
        productName: order.productName,
        productType: enumToCategory(order.productType as string),
        unit: order.unit,
        totalCommitted: 0, totalRevenue: 0, remainingDemand: 0,
        status: item.status, itemCount: 0, pricePerUnit: item.pricePerUnit,
      };
    }
    grouped[key].totalCommitted += item.quantity;
    grouped[key].totalRevenue += item.totalPrice;
    grouped[key].remainingDemand += Math.max(0, order.totalQuantity - order.fulfilledQuantity);
    grouped[key].itemCount++;
    // bubble up: accepted > completed > pending
    if (item.status === 'accepted') grouped[key].status = 'accepted';
    else if (item.status === 'completed' && grouped[key].status !== 'accepted') grouped[key].status = 'completed';
  }
  return Object.values(grouped);
}

/** Accept all available orders for a product — distributes qty across orders oldest-first. */
export async function acceptGroupedProduct(data: {
  vendorId: string; productName: string; quantity: number; pricePerUnit: number;
}): Promise<{ success: true; items: any[] } | { success: false; message: string }> {
  const vendor = await prisma.user.findUnique({ where: { id: data.vendorId } });
  if (!vendor?.category) return { success: false, message: 'Vendor has no category' };

  const orders = await prisma.order.findMany({
    where: { productName: data.productName, productType: vendor.category, status: { in: ['pending', 'partial'] } },
    orderBy: { createdAt: 'asc' },
  });
  const vendorItems = await prisma.orderItem.findMany({
    where: { vendorId: data.vendorId, status: { not: 'rejected' } },
    select: { orderId: true },
  });
  const committedIds = new Set(vendorItems.map((i: any) => i.orderId));

  let rem = data.quantity;
  const created: any[] = [];

  for (const order of orders) {
    if (rem <= 0) break;
    if (committedIds.has(order.id)) continue;
    const avail = order.totalQuantity - order.fulfilledQuantity;
    if (avail <= 0) continue;
    const qty = Math.min(rem, avail);
    const item = await createOrderItem({
      orderId: order.id, vendorId: data.vendorId,
      quantity: qty, pricePerUnit: data.pricePerUnit, totalPrice: qty * data.pricePerUnit,
    });
    created.push(item);
    rem -= qty;
  }

  if (!created.length) return { success: false, message: 'No available orders for this product' };
  return { success: true, items: created };
}

/** Increase vendor's total supply for a product by committing to new unfulfilled orders. */
export async function increaseGroupedProductQuantity(data: {
  vendorId: string; productName: string; additionalQuantity: number;
}): Promise<{ success: true; items: any[]; addedQty: number } | { success: false; message: string }> {
  const vendor = await prisma.user.findUnique({ where: { id: data.vendorId } });
  if (!vendor?.category) return { success: false, message: 'Vendor has no category' };

  // Get existing items for price reference
  const existingItems = await prisma.orderItem.findMany({
    where: { vendorId: data.vendorId, status: { not: 'rejected' } },
    include: { order: true },
  });
  const priceRef = (existingItems.find((i: any) => (i.order as any)?.productName === data.productName) as any)?.pricePerUnit ?? 0;

  const orders = await prisma.order.findMany({
    where: { productName: data.productName, productType: vendor.category, status: { in: ['pending', 'partial'] } },
    orderBy: { createdAt: 'asc' },
  });
  const committedIds = new Set(existingItems.map((i: any) => i.orderId));
  const uncommitted = orders.filter((o: any) => !committedIds.has(o.id) && (o.totalQuantity - o.fulfilledQuantity) > 0);

  if (!uncommitted.length) return { success: false, message: 'No remaining demand for this product' };

  let rem = data.additionalQuantity;
  const created: any[] = [];

  for (const order of uncommitted) {
    if (rem <= 0) break;
    const avail = order.totalQuantity - order.fulfilledQuantity;
    const qty = Math.min(rem, avail);
    const item = await createOrderItem({
      orderId: order.id, vendorId: data.vendorId,
      quantity: qty, pricePerUnit: priceRef, totalPrice: qty * priceRef,
    });
    created.push(item);
    rem -= qty;
  }

  if (!created.length) return { success: false, message: 'No remaining demand for this product' };
  return { success: true, items: created, addedQty: data.additionalQuantity - rem };
}

/** All order items enriched with order, customer and vendor info — for admin sales. */
export async function getAllOrderItemsEnriched() {
  const [items, orders, users] = await Promise.all([
    prisma.orderItem.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
  ]);
  return items.map((item: any) => {
    const order = orders.find((o: any) => o.id === item.orderId);
    const vendor = users.find((u: any) => u.id === item.vendorId);
    const customer = order ? users.find((u: any) => u.id === order.customerId) : null;
    return {
      ...item,
      productName: order?.productName ?? '',
      productType: order ? enumToCategory(order.productType as string) : '',
      unit: order?.unit ?? '',
      orderStatus: order?.status ?? '',
      orderTotalQty: order?.totalQuantity ?? 0,
      vendorName: vendor?.name ?? item.vendorId,
      vendorEmail: vendor?.email ?? '',
      customerName: customer?.name ?? order?.customerId ?? '',
      customerEmail: customer?.email ?? '',
    };
  });
}
