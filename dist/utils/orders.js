// Seed orders
export const seedOrders = [
    {
        id: "order-1",
        customerId: "user-1",
        meatType: "Buffalo Meat",
        totalQuantity: 30,
        unit: "kg",
        status: "pending",
        fulfilledQuantity: 0,
        createdAt: new Date("2024-01-15").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
    },
    {
        id: "order-2",
        customerId: "user-2",
        meatType: "Goat Meat",
        totalQuantity: 15,
        unit: "kg",
        status: "partial",
        fulfilledQuantity: 10,
        createdAt: new Date("2024-01-16").toISOString(),
        updatedAt: new Date("2024-01-16").toISOString(),
    },
];
// Seed order items
export const seedOrderItems = [
    {
        id: "order-item-1",
        orderId: "order-1",
        vendorId: "user-3",
        quantity: 10,
        pricePerUnit: 500,
        totalPrice: 5000,
        status: "accepted",
        createdAt: new Date("2024-01-15").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
    },
    {
        id: "order-item-2",
        orderId: "order-1",
        vendorId: "user-4",
        quantity: 15,
        pricePerUnit: 480,
        totalPrice: 7200,
        status: "pending",
        createdAt: new Date("2024-01-15").toISOString(),
        updatedAt: new Date("2024-01-15").toISOString(),
    },
    {
        id: "order-item-3",
        orderId: "order-2",
        vendorId: "user-3",
        quantity: 10,
        pricePerUnit: 600,
        totalPrice: 6000,
        status: "completed",
        createdAt: new Date("2024-01-16").toISOString(),
        updatedAt: new Date("2024-01-16").toISOString(),
    },
];
// Seed transactions
export const seedTransactions = [
    {
        id: "trans-1",
        orderItemId: "order-item-3",
        orderId: "order-2",
        customerId: "user-2",
        vendorId: "user-3",
        quantity: 10,
        pricePerUnit: 600,
        totalPrice: 6000,
        status: "completed",
        createdAt: new Date("2024-01-16").toISOString(),
        completedAt: new Date("2024-01-16").toISOString(),
    },
];
// In-memory storage
let orders = [...seedOrders];
let orderItems = [...seedOrderItems];
let transactions = [...seedTransactions];
export function getAllOrders() {
    return orders;
}
export function getOrderById(id) {
    return orders.find((o) => o.id === id);
}
export function getOrdersByCustomerId(customerId) {
    return orders.filter((o) => o.customerId === customerId);
}
export function getOrdersByVendorId(vendorId) {
    return orderItems.filter((oi) => oi.vendorId === vendorId);
}
export function createOrder(data) {
    const newOrder = {
        ...data,
        id: `order-${orders.length + 1}`,
        status: "pending",
        fulfilledQuantity: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    orders.push(newOrder);
    return newOrder;
}
export function createOrderItem(data) {
    const newOrderItem = {
        ...data,
        id: `order-item-${orderItems.length + 1}`,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    orderItems.push(newOrderItem);
    // Update order fulfilled quantity
    const order = orders.find((o) => o.id === data.orderId);
    if (order) {
        const acceptedItems = orderItems.filter((oi) => oi.orderId === data.orderId && oi.status === "accepted");
        order.fulfilledQuantity = acceptedItems.reduce((sum, oi) => sum + oi.quantity, 0);
        // Update order status
        if (order.fulfilledQuantity >= order.totalQuantity) {
            order.status = "completed";
        }
        else if (order.fulfilledQuantity > 0) {
            order.status = "partial";
        }
        order.updatedAt = new Date().toISOString();
    }
    return newOrderItem;
}
export function updateOrderItemStatus(id, status) {
    const orderItem = orderItems.find((oi) => oi.id === id);
    if (!orderItem)
        return undefined;
    orderItem.status = status;
    orderItem.updatedAt = new Date().toISOString();
    // Update order fulfilled quantity
    const order = orders.find((o) => o.id === orderItem.orderId);
    if (order) {
        const acceptedItems = orderItems.filter((oi) => oi.orderId === orderItem.orderId && oi.status === "accepted");
        order.fulfilledQuantity = acceptedItems.reduce((sum, oi) => sum + oi.quantity, 0);
        // Update order status
        if (order.fulfilledQuantity >= order.totalQuantity) {
            order.status = "completed";
        }
        else if (order.fulfilledQuantity > 0) {
            order.status = "partial";
        }
        else {
            order.status = "pending";
        }
        order.updatedAt = new Date().toISOString();
    }
    // Create transaction if completed
    if (status === "completed" && order) {
        const newTransaction = {
            id: `trans-${transactions.length + 1}`,
            orderItemId: orderItem.id,
            orderId: orderItem.orderId,
            customerId: order.customerId,
            vendorId: orderItem.vendorId,
            quantity: orderItem.quantity,
            pricePerUnit: orderItem.pricePerUnit,
            totalPrice: orderItem.totalPrice,
            status: "completed",
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
        };
        transactions.push(newTransaction);
    }
    return orderItem;
}
export function getAllTransactions() {
    return transactions;
}
export function getTransactionsByCustomerId(customerId) {
    return transactions.filter((t) => t.customerId === customerId);
}
export function getTransactionsByVendorId(vendorId) {
    return transactions.filter((t) => t.vendorId === vendorId);
}
