import { prisma } from '../lib/prisma.js';
import { categoryToEnum } from './users.js';
import { VendorCategory } from '../types/auth.js';

export async function getProductsByVendorId(vendorId: string) {
  return prisma.vendorProduct.findMany({ where: { vendorId }, orderBy: { updatedAt: 'desc' } });
}

export async function getAllVendorProducts() {
  return prisma.vendorProduct.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function addOrUpdateVendorProduct(data: {
  vendorId: string;
  productName: string;
  productType: VendorCategory;
  unit: string;
  quantity: number;
  pricePerUnit: number;
}) {
  return prisma.vendorProduct.upsert({
    where: { vendorId_productName: { vendorId: data.vendorId, productName: data.productName } },
    update: {
      quantity: { increment: data.quantity },
      pricePerUnit: data.pricePerUnit,
    },
    create: {
      vendorId: data.vendorId,
      productName: data.productName,
      productType: categoryToEnum(data.productType),
      unit: data.unit,
      quantity: data.quantity,
      pricePerUnit: data.pricePerUnit,
    },
  });
}
