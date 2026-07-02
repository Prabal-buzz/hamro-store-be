import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getAllUsers, findUserById, createUser, updateUser, deleteUser, enumToCategory } from '../utils/users.js';
import { AppError } from '../utils/app-error.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.middleware.js';
import { AuthenticatedRequest, VendorCategory, VENDOR_CATEGORIES } from '../types/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'customer', 'vendor']).default('customer'),
  category: z.enum(VENDOR_CATEGORIES as [VendorCategory, ...VendorCategory[]]).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'pending']).optional(),
  category: z.enum(VENDOR_CATEGORIES as [VendorCategory, ...VendorCategory[]]).optional(),
});

const adminOrSelfMiddleware = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (req.user?.role === 'admin' || req.user?.id === req.params.id) return next();
  return next(new AppError('Access denied.', 403));
};

// GET /users/me — current user's profile (any role)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, status: true, dashboardUrl: true, category: true, collateral: true, createdAt: true },
    });
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
});

// GET /users/customer-profile
router.get('/customer-profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customerId = req.user!.id;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, "customerId", "companyName", pan, "vatNumber", phone, address, "updatedAt"
      FROM customer_profiles WHERE "customerId" = ${customerId}
    `;
    const profile = rows[0] ?? { customerId, companyName: null, pan: null, vatNumber: null, phone: null, address: null };
    res.json({ success: true, data: { profile } });
  } catch (error) { next(error); }
});

// PUT /users/customer-profile
router.put('/customer-profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      companyName: z.string().optional(),
      pan: z.string().max(20).optional(),
      vatNumber: z.string().max(20).optional(),
      phone: z.string().max(20).optional(),
      address: z.string().optional(),
    });
    const { companyName, pan, vatNumber, phone, address } = schema.parse(req.body);
    const customerId = req.user!.id;
    const existing = await prisma.$queryRaw<any[]>`SELECT id FROM customer_profiles WHERE "customerId" = ${customerId}`;
    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE customer_profiles SET
          "companyName" = ${companyName ?? null}, pan = ${pan ?? null},
          "vatNumber" = ${vatNumber ?? null}, phone = ${phone ?? null},
          address = ${address ?? null}, "updatedAt" = NOW()
        WHERE "customerId" = ${customerId}
      `;
    } else {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO customer_profiles (id, "customerId", "companyName", pan, "vatNumber", phone, address, "updatedAt")
        VALUES (${id}, ${customerId}, ${companyName ?? null}, ${pan ?? null}, ${vatNumber ?? null}, ${phone ?? null}, ${address ?? null}, NOW())
      `;
    }
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, "customerId", "companyName", pan, "vatNumber", phone, address, "updatedAt"
      FROM customer_profiles WHERE "customerId" = ${customerId}
    `;
    res.json({ success: true, data: { profile: rows[0] } });
  } catch (error) { next(error); }
});

// PUT /users/me — update own name
router.put('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name },
      select: { id: true, email: true, name: true, role: true, status: true, collateral: true, createdAt: true },
    });
    res.json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
});

// GET /users/vendor-profile — get current vendor's business profile
router.get('/vendor-profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const vendorId = req.user!.id;
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, "vendorId", "companyName", pan, "vatNumber", phone, address, email, "updatedAt"
      FROM vendor_profiles
      WHERE "vendorId" = ${vendorId}
    `;
    const profile = rows[0] ?? { vendorId, companyName: null, pan: null, vatNumber: null, phone: null, address: null, email: null };
    res.json({ success: true, data: { profile } });
  } catch (error) { next(error); }
});

// PUT /users/vendor-profile — create or update current vendor's business profile
router.put('/vendor-profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      companyName: z.string().optional(),
      pan: z.string().max(20).optional(),
      vatNumber: z.string().max(20).optional(),
      phone: z.string().max(20).optional(),
      address: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
    });
    const { companyName, pan, vatNumber, phone, address, email } = schema.parse(req.body);
    const vendorId = req.user!.id;

    // Upsert: insert or update on conflict
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM vendor_profiles WHERE "vendorId" = ${vendorId}
    `;

    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE vendor_profiles
        SET "companyName" = ${companyName ?? null},
            pan           = ${pan ?? null},
            "vatNumber"   = ${vatNumber ?? null},
            phone         = ${phone ?? null},
            address       = ${address ?? null},
            email         = ${email || null},
            "updatedAt"   = NOW()
        WHERE "vendorId" = ${vendorId}
      `;
    } else {
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO vendor_profiles (id, "vendorId", "companyName", pan, "vatNumber", phone, address, email, "updatedAt")
        VALUES (${id}, ${vendorId}, ${companyName ?? null}, ${pan ?? null}, ${vatNumber ?? null}, ${phone ?? null}, ${address ?? null}, ${email || null}, NOW())
      `;
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, "vendorId", "companyName", pan, "vatNumber", phone, address, email, "updatedAt"
      FROM vendor_profiles WHERE "vendorId" = ${vendorId}
    `;
    res.json({ success: true, data: { profile: rows[0] } });
  } catch (error) { next(error); }
});

// PUT /users/:id/collateral — admin sets a customer's collateral/deposit amount
router.put('/:id/collateral', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { collateral } = z.object({ collateral: z.number().min(0) }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { collateral },
      select: { id: true, name: true, email: true, collateral: true },
    });
    res.json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
});

// GET /users/customer-financials — aggregate collateral vs order totals (admin)
router.get('/customer-financials', authMiddleware, adminMiddleware, async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'customer' },
      select: {
        id: true, name: true, email: true, collateral: true,
        orders: {
          select: {
            items: {
              where: { status: { in: ['accepted', 'completed'] } },
              select: { totalPrice: true },
            },
          },
        },
      },
    });

    let totalCollateral = 0;
    let youWillReceive = 0; // customers owe beyond collateral (additional collection)
    let youWillPay = 0;     // excess collateral to return to customers

    const breakdown = customers.map((c) => {
      const orderTotal = c.orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.totalPrice, 0), 0);
      totalCollateral += c.collateral;
      const balance = c.collateral - orderTotal; // positive = excess collateral; negative = customer owes more
      if (balance >= 0) youWillPay += balance;
      else youWillReceive += Math.abs(balance);
      return { id: c.id, name: c.name, email: c.email, collateral: c.collateral, orderTotal, balance };
    });

    res.json({ status: 'success', data: { totalCollateral, youWillReceive, youWillPay, customers: breakdown } });
  } catch (error) { next(error); }
});

// GET /users/vendor-financials — per-vendor earned/paid/outstanding (admin)
router.get('/vendor-financials', authMiddleware, adminMiddleware, async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const [vendors, orderItems, vendorPayments] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'vendor' },
        select: { id: true, name: true, email: true, category: true },
      }),
      prisma.orderItem.findMany({
        where: { status: { in: ['accepted', 'completed'] } },
        select: { vendorId: true, totalPrice: true, status: true },
      }),
      prisma.$queryRaw<{ vendorId: string; amount: number }[]>`
        SELECT "vendorId", amount FROM vendor_payments
      `,
    ]);

    let totalPayable = 0;
    let totalPaid = 0;

    const vendorMap = new Map<string, {
      vendorId: string; vendorName: string; vendorEmail: string; category: string;
      totalEarned: number; totalPaid: number; outstanding: number;
    }>();

    for (const v of vendors) {
      vendorMap.set(v.id, {
        vendorId: v.id,
        vendorName: v.name,
        vendorEmail: v.email,
        category: v.category ? enumToCategory(v.category as string) : '',
        totalEarned: 0, totalPaid: 0, outstanding: 0,
      });
    }

    for (const item of orderItems) {
      totalPayable += item.totalPrice;
      const v = vendorMap.get(item.vendorId);
      if (v) v.totalEarned += item.totalPrice;
    }

    for (const pay of vendorPayments) {
      totalPaid += pay.amount;
      const v = vendorMap.get(pay.vendorId);
      if (v) v.totalPaid += pay.amount;
    }

    const vendorList = Array.from(vendorMap.values())
      .map((v) => ({ ...v, outstanding: Math.max(0, v.totalEarned - v.totalPaid) }))
      .filter((v) => v.totalEarned > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    res.json({
      success: true,
      data: {
        totalPayable,
        totalPaid,
        outstanding: Math.max(0, totalPayable - totalPaid),
        vendors: vendorList,
      },
    });
  } catch (error) { next(error); }
});

// POST /users/:id/vendor-payments — record a physical payment to a vendor (admin)
router.post('/:id/vendor-payments', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const schema = z.object({
      amount: z.number().positive('Amount must be positive'),
      method: z.enum(['cash', 'bank_transfer', 'cheque', 'online']).default('cash'),
      note: z.string().optional(),
      paidAt: z.string().optional(),
    });
    const { amount, method, note, paidAt } = schema.parse(req.body);

    const id = randomUUID();
    const paidAtDate = paidAt ? new Date(paidAt) : new Date();
    const noteVal = note ?? null;
    const recordedBy = req.user!.id;
    const vendorId = req.params.id;

    await prisma.$executeRaw`
      INSERT INTO vendor_payments (id, "vendorId", amount, method, note, "paidAt", "recordedBy", "createdAt")
      VALUES (${id}, ${vendorId}, ${amount}, ${method}, ${noteVal}, ${paidAtDate}, ${recordedBy}, NOW())
    `;

    const payment = { id, vendorId, amount, method, note: noteVal, paidAt: paidAtDate, recordedBy, createdAt: new Date() };
    res.status(201).json({ success: true, data: { payment } });
  } catch (error) { next(error); }
});

// GET /users/:id/vendor-payments — list physical payment history for a vendor (admin)
router.get('/:id/vendor-payments', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const vendorId = req.params.id;
    const payments = await prisma.$queryRaw<any[]>`
      SELECT id, "vendorId", amount, method, note, "paidAt", "recordedBy", "createdAt"
      FROM vendor_payments
      WHERE "vendorId" = ${vendorId}
      ORDER BY "paidAt" DESC
    `;
    res.json({ success: true, data: { payments } });
  } catch (error) { next(error); }
});

// GET /users — list all users (admin)
router.get('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, name: true, role: true, status: true, dashboardUrl: true, category: true, collateral: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ status: 'success', data: { users, total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

// GET /users/:id
router.get('/:id', authMiddleware, adminOrSelfMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, role: true, status: true, dashboardUrl: true, category: true, createdAt: true },
    });
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: { user } });
  } catch (error) { next(error); }
});

// POST /users — create user (admin)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validation = createUserSchema.safeParse(req.body);
    if (!validation.success) return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));

    const { email, password, name, role, category } = validation.data;
    if (role === 'vendor' && !category) return next(new AppError('Category is required for vendor accounts', 400));

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(new AppError('Email already exists', 400));

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, role, name, dashboardUrl: `/${role}/dashboard`, category });

    const { passwordHash: _, ...safe } = user;
    res.status(201).json({ status: 'success', data: { user: safe } });
  } catch (error) { next(error); }
});

// PUT /users/:id
router.put('/:id', authMiddleware, adminOrSelfMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validation = updateUserSchema.safeParse(req.body);
    if (!validation.success) return next(new AppError(validation.error.errors.map(e => e.message).join(', '), 400));

    const existing = await findUserById(req.params.id);
    if (!existing) return next(new AppError('User not found', 404));

    const updates: any = { ...validation.data };
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const user = await updateUser(req.params.id, updates);
    const { passwordHash: _, ...safe } = user;
    res.json({ status: 'success', data: { user: safe } });
  } catch (error) { next(error); }
});

// PUT /users/:id/approve
router.put('/:id/approve', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    if (user.status !== 'pending') return next(new AppError('User is not in a pending state', 400));
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'active' } });
    const { passwordHash: _, ...safe } = updated;
    res.json({ status: 'success', data: { user: safe } });
  } catch (error) { next(error); }
});

// PUT /users/:id/reject
router.put('/:id/reject', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    if (user.status !== 'pending') return next(new AppError('User is not in a pending state', 400));
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { status: 'suspended' } });
    const { passwordHash: _, ...safe } = updated;
    res.json({ status: 'success', data: { user: safe } });
  } catch (error) { next(error); }
});

// DELETE /users/:id
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    await deleteUser(req.params.id);
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
