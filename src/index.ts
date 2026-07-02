import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

// Handle uncaught exceptions before doing anything else
process.on('uncaughtException', (err: Error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

const server = http.createServer(app);

async function ensureTables(): Promise<void> {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS vendor_payments (
      id          TEXT PRIMARY KEY,
      "vendorId"  TEXT NOT NULL,
      amount      DOUBLE PRECISION NOT NULL,
      method      TEXT NOT NULL DEFAULT 'cash',
      note        TEXT,
      "paidAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "recordedBy" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS custom_order_requests (
      id            TEXT PRIMARY KEY,
      "customerId"  TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      category      TEXT NOT NULL,
      quantity      DOUBLE PRECISION NOT NULL,
      unit          TEXT NOT NULL,
      note          TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      "adminNote"   TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS vendor_profiles (
      id            TEXT PRIMARY KEY,
      "vendorId"    TEXT NOT NULL UNIQUE,
      "companyName" TEXT,
      pan           TEXT,
      "vatNumber"   TEXT,
      phone         TEXT,
      address       TEXT,
      email         TEXT,
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Add email column if table already existed without it
  await prisma.$executeRaw`
    ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS email TEXT
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS customer_profiles (
      id            TEXT PRIMARY KEY,
      "customerId"  TEXT NOT NULL UNIQUE,
      "companyName" TEXT,
      pan           TEXT,
      "vatNumber"   TEXT,
      phone         TEXT,
      address       TEXT,
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS services (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      price         DOUBLE PRECISION NOT NULL DEFAULT 0,
      "priceType"   TEXT NOT NULL DEFAULT 'monthly',
      icon          TEXT NOT NULL DEFAULT 'home_repair_service',
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS customer_services (
      id            TEXT PRIMARY KEY,
      "customerId"  TEXT NOT NULL,
      "serviceId"   TEXT NOT NULL,
      "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
      "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "activatedBy" TEXT,
      UNIQUE("customerId", "serviceId")
    )
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS service_requests (
      id            TEXT PRIMARY KEY,
      "customerId"  TEXT NOT NULL,
      "serviceId"   TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      note          TEXT,
      "adminNote"   TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

const startServer = async (): Promise<void> => {
  await ensureTables();
  const port = env.PORT;
  server.listen(port, () => {
    console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${port}`);
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: any) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err?.name || 'Error', err?.message || err);
  
  // Gracefully close server before exiting
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown on SIGTERM / SIGINT
const handleGracefulShutdown = (signal: string) => {
  console.log(`\n👋 ${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('💥 Process terminated!');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if closing server takes too long
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
