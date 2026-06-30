import { prisma } from '../lib/prisma.js';
import { categoryToEnum } from './users.js';
export async function getCart(customerId) {
    return prisma.cartItem.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } });
}
export async function addToCart(customerId, input) {
    const existing = await prisma.cartItem.findFirst({
        where: {
            customerId,
            productName: input.productName,
            productType: categoryToEnum(input.productType),
        },
    });
    if (existing) {
        const newQty = existing.quantity + input.quantity;
        return prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: newQty, totalPrice: newQty * existing.pricePerUnit },
        });
    }
    return prisma.cartItem.create({
        data: {
            customerId,
            productName: input.productName,
            productType: categoryToEnum(input.productType),
            unit: input.unit,
            quantity: input.quantity,
            pricePerUnit: input.pricePerUnit,
            totalPrice: input.quantity * input.pricePerUnit,
            imageUrl: input.imageUrl,
        },
    });
}
export async function updateCartItem(customerId, itemId, quantity) {
    const item = await prisma.cartItem.findFirst({ where: { id: itemId, customerId } });
    if (!item)
        return null;
    return prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity, totalPrice: quantity * item.pricePerUnit },
    });
}
export async function removeCartItem(customerId, itemId) {
    const item = await prisma.cartItem.findFirst({ where: { id: itemId, customerId } });
    if (!item)
        return false;
    await prisma.cartItem.delete({ where: { id: itemId } });
    return true;
}
export async function clearCart(customerId) {
    await prisma.cartItem.deleteMany({ where: { customerId } });
}
