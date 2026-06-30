import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: 'user-admin-1',
      email: 'admin@hamrostore.com',
      passwordHash,
      role: 'admin' as const,
      name: 'Admin User',
      dashboardUrl: '/admin/dashboard',
      status: 'active' as const,
    },
    {
      id: 'user-customer-1',
      email: 'customer@hamrostore.com',
      passwordHash,
      role: 'customer' as const,
      name: 'Customer User',
      dashboardUrl: '/customer/dashboard',
      status: 'active' as const,
    },
    {
      id: 'user-vendor-1',
      email: 'vendor@hamrostore.com',
      passwordHash,
      role: 'vendor' as const,
      name: 'Vendor User',
      dashboardUrl: '/vendor/dashboard',
      status: 'active' as const,
      category: 'Non_Veg' as const,
    },
    {
      id: 'user-vendor-2',
      email: 'vendor2@hamrostore.com',
      passwordHash,
      role: 'vendor' as const,
      name: 'Vendor Vegetables',
      dashboardUrl: '/vendor/dashboard',
      status: 'active' as const,
      category: 'Vegetables_and_Fruits' as const,
    },
    {
      id: 'user-vendor-3',
      email: 'vendor3@hamrostore.com',
      passwordHash,
      role: 'vendor' as const,
      name: 'Vendor Grocery',
      dashboardUrl: '/vendor/dashboard',
      status: 'active' as const,
      category: 'Grocery' as const,
    },
    {
      id: 'user-vendor-4',
      email: 'vendor4@hamrostore.com',
      passwordHash,
      role: 'vendor' as const,
      name: 'Vendor Spices',
      dashboardUrl: '/vendor/dashboard',
      status: 'active' as const,
      category: 'Spices' as const,
    },
    {
      id: 'user-vendor-5',
      email: 'vendor5@hamrostore.com',
      passwordHash,
      role: 'vendor' as const,
      name: 'Vendor Beverages',
      dashboardUrl: '/vendor/dashboard',
      status: 'active' as const,
      category: 'Beverages' as const,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: user,
    });
    console.log(`Upserted: ${user.email}`);
  }

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
