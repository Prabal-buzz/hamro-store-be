import { prisma } from '../lib/prisma.js';
import { VendorCategory } from '../types/auth.js';

// User type matching the Prisma schema shape
export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'customer' | 'vendor';
  name: string;
  dashboardUrl: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  category?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getAllUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  role: 'admin' | 'customer' | 'vendor';
  name: string;
  dashboardUrl: string;
  category?: VendorCategory;
}) {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      name: data.name,
      dashboardUrl: data.dashboardUrl,
      category: data.category ? categoryToEnum(data.category) : undefined,
      status: 'active',
    },
  });
}

export async function updateUser(id: string, data: Partial<{
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  category: VendorCategory;
  passwordHash: string;
}>) {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      category: data.category ? categoryToEnum(data.category) : undefined,
    },
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

// Prisma stores enum keys like "Non_Veg"; the app uses "Non Veg" strings.
export function categoryToEnum(cat: VendorCategory) {
  return cat.replace(/ /g, '_') as any;
}

export function enumToCategory(val: string): VendorCategory {
  return val.replace(/_/g, ' ') as VendorCategory;
}
